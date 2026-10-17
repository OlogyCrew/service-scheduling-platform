import mysql from "mysql2/promise";

if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is required");
// The live marketplace can grow between releases. A test runner may supply its
// read-only pre-run counts; the historical cleanup baseline remains the default.
const expectedAdminRealCounts = JSON.parse(process.env.CLEANUP_EXPECTED_COUNTS ?? '{"users":22,"providers":13,"bookings":7}');
if (!expectedAdminRealCounts || Object.keys(expectedAdminRealCounts).length !== 3 ||
    !["users", "providers", "bookings"].every(key => Number.isSafeInteger(expectedAdminRealCounts[key]) && expectedAdminRealCounts[key] >= 0)) {
  throw new Error("CLEANUP_EXPECTED_COUNTS must contain exactly three nonnegative integer counts: users, providers, bookings");
}
const connection = await mysql.createConnection(process.env.DATABASE_URL);
const scalar = async (sql, params = []) => Number((await connection.query(sql, params))[0][0]?.count ?? 0);

const exactTestUsers = await scalar(`SELECT COUNT(*) AS count FROM users WHERE LOWER(TRIM(SUBSTRING_INDEX(COALESCE(email,''),'@',-1)))='test.com'`);
const exactTestProviders = await scalar(`SELECT COUNT(*) AS count FROM service_providers sp INNER JOIN users u ON u.id=sp.userId WHERE LOWER(TRIM(SUBSTRING_INDEX(COALESCE(u.email,''),'@',-1)))='test.com'`);
const prattisRows = await scalar(`SELECT COUNT(*) AS count FROM users u LEFT JOIN service_providers sp ON sp.userId=u.id WHERE u.id=214381102 OR sp.id=1680002 OR LOWER(TRIM(sp.businessName))='prattis test'`);
const prattisSubscriptions = await scalar(`SELECT COUNT(*) AS count FROM provider_subscriptions WHERE id=1110002 OR providerId=1680002`);
const orphanRows = {
  providers: await scalar(`SELECT COUNT(*) AS count FROM service_providers WHERE id=2310003`),
  services: await scalar(`SELECT COUNT(*) AS count FROM services WHERE id=2850001`),
  bookings: await scalar(`SELECT COUNT(*) AS count FROM bookings WHERE id=2430001`),
  quotes: await scalar(`SELECT COUNT(*) AS count FROM quote_requests WHERE id IN (90001,90002)`),
  payments: await scalar(`SELECT COUNT(*) AS count FROM payments WHERE id=60001 OR stripePaymentIntentId='pi_test_crm_phase2_1788735775339-lnsbcx'`),
};
const officialDemo = (await connection.query(`
  SELECT u.id AS userId, u.email, sp.id AS providerId, sp.businessName, sp.isActive,
         (SELECT COUNT(*) FROM services s WHERE s.providerId=sp.id) AS services,
         (SELECT COUNT(*) FROM bookings b WHERE b.providerId=sp.id) AS bookings
    FROM service_providers sp INNER JOIN users u ON u.id=sp.userId
   WHERE sp.isOfficial=1
`))[0];
const protectedAdmins = (await connection.query(`
  SELECT LOWER(email) AS email, role, deletedAt FROM users
   WHERE LOWER(email) IN ('garychisolm30@gmail.com','wwilliams@visionkwest.com')
   ORDER BY email
`))[0];
const partnerTransfers = await scalar(`SELECT COUNT(*) AS count FROM partner_transfers`);
const preservedAuditTargets = await scalar(`
  SELECT COUNT(*) AS count FROM audit_log
   WHERE (targetType='user' AND targetId IN (SELECT id FROM users WHERE 1=0))
      OR targetType IN ('provider','booking','user')
`);
const totalAuditRows = await scalar(`SELECT COUNT(*) AS count FROM audit_log`);

const realUsers = await scalar(`
  SELECT COUNT(*) AS count FROM users u
   WHERE u.deletedAt IS NULL
     AND LOWER(TRIM(SUBSTRING_INDEX(COALESCE(u.email,''),'@',-1))) NOT IN ('test.com','example.invalid')
     AND COALESCE(u.loginMethod,'') <> 'test'
     AND u.openId NOT LIKE 'test-%' AND u.openId NOT LIKE 'test\\_%'
     AND NOT EXISTS (SELECT 1 FROM service_providers sp WHERE sp.userId=u.id AND (sp.isOfficial=1 OR sp.id=1680002 OR LOWER(TRIM(sp.businessName))='prattis test'))
`);
const realProviders = await scalar(`
  SELECT COUNT(*) AS count FROM service_providers sp INNER JOIN users u ON u.id=sp.userId
   WHERE sp.isActive=1 AND sp.deletedAt IS NULL AND u.deletedAt IS NULL AND sp.isOfficial=0
     AND sp.id<>1680002 AND LOWER(TRIM(sp.businessName))<>'prattis test'
     AND LOWER(TRIM(SUBSTRING_INDEX(COALESCE(u.email,''),'@',-1))) NOT IN ('test.com','example.invalid')
     AND COALESCE(u.loginMethod,'') <> 'test' AND u.openId NOT LIKE 'test-%' AND u.openId NOT LIKE 'test\\_%'
`);
const realBookings = await scalar(`
  SELECT COUNT(*) AS count FROM bookings b
  INNER JOIN users cu ON cu.id=b.customerId
  INNER JOIN service_providers sp ON sp.id=b.providerId
  INNER JOIN users pu ON pu.id=sp.userId
  WHERE cu.deletedAt IS NULL AND pu.deletedAt IS NULL AND sp.isOfficial=0
    AND sp.id<>1680002 AND LOWER(TRIM(sp.businessName))<>'prattis test'
    AND LOWER(TRIM(SUBSTRING_INDEX(COALESCE(cu.email,''),'@',-1))) NOT IN ('test.com','example.invalid')
    AND LOWER(TRIM(SUBSTRING_INDEX(COALESCE(pu.email,''),'@',-1))) NOT IN ('test.com','example.invalid')
    AND COALESCE(cu.loginMethod,'')<>'test' AND COALESCE(pu.loginMethod,'')<>'test'
    AND cu.openId NOT LIKE 'test-%' AND pu.openId NOT LIKE 'test-%'
    AND cu.openId NOT LIKE 'test\\_%' AND pu.openId NOT LIKE 'test\\_%'
`);

const result = {
  verifiedAt: new Date().toISOString(),
  deletedScopeRemaining: { exactTestUsers, exactTestProviders, prattisRows, prattisSubscriptions, orphanRows },
  protected: { officialDemo, protectedAdmins, partnerTransfers, totalAuditRows, preservedAuditTargets },
  adminRealCounts: { users: realUsers, providers: realProviders, bookings: realBookings },
  expectedAdminRealCounts,
};
const remaining = [exactTestUsers, exactTestProviders, prattisRows, prattisSubscriptions, ...Object.values(orphanRows)].reduce((sum, value) => sum + value, 0);
if (remaining !== 0) throw new Error(`Approved test scope still has ${remaining} records`);
if (officialDemo.length !== 1 || Number(officialDemo[0].isActive) !== 1 || Number(officialDemo[0].services) < 1) throw new Error("Official demo was not preserved correctly");
if (protectedAdmins.length !== 2 || protectedAdmins.some((item) => item.deletedAt)) throw new Error("Gary or Winston was not preserved correctly");
if (partnerTransfers !== 11 || totalAuditRows < 84) throw new Error("Protected transfer or audit history changed unexpectedly");
if (realUsers !== expectedAdminRealCounts.users || realProviders !== expectedAdminRealCounts.providers || realBookings !== expectedAdminRealCounts.bookings) throw new Error(`Admin real counts drifted: ${JSON.stringify({ realUsers, realProviders, realBookings })}`);

console.log(JSON.stringify(result, null, 2));
await connection.end();

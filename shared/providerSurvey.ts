export const PROVIDER_SURVEY_QUESTIONS = [
  { id: "uses", label: "How do you currently use OlogyCrew?", options: ["List services for discovery", "Receive booking requests", "Receive quote requests", "Manage my schedule", "Collect online payments", "Still setting up my profile", "Other"] },
  { id: "payment", label: "When a customer books with you, how do you usually collect payment?", options: ["Online through OlogyCrew", "Reserve online and pay at the location", "Pay after the service", "It depends on the service", "I have not received a booking yet"] },
  { id: "serviceType", label: "What type of service do you mainly provide?", options: ["Hair, beauty, or grooming", "DJ, music, or entertainment", "Photography, video, or creative services", "Home, auto, or repair services", "Professional, technology, or business services", "Health, fitness, or wellness services", "Other"] },
  { id: "customerGoal", label: "How do you expect customers to use your OlogyCrew listing?", options: ["Discover my business", "Reserve an appointment", "Request a quote", "Pay online", "Contact me before booking", "I am still deciding"] },
  { id: "improvement", label: "What is the biggest improvement you would like to see?", options: ["Pay-at-location reservations", "Better calendar and availability tools", "More customer discovery", "Easier service setup", "Better booking notifications", "Better payment and payout information", "Other"] },
  { id: "contact", label: "Would you like someone from OlogyCrew to contact you about your provider setup?", options: ["Yes", "No"] },
] as const;

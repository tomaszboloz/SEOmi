/**
 * Small seed of English MeSH descriptor names for the YMYL fact gate (#137).
 * MeSH is produced by the U.S. National Library of Medicine and is in the public domain
 * (https://www.nlm.nih.gov/databases/download/terms_and_conditions.html). See docs/YMYL_TERM_DATA.md.
 * No ICD-10 data is bundled: its licence is restricted, users import their own list.
 */
export const MESH_SEED_SOURCE = 'MeSH (NLM, public domain) seed';

export const MESH_SEED_TERMS: readonly string[] = [
  'Acetaminophen', 'Allopurinol', 'Amlodipine', 'Amoxicillin', 'Aspirin', 'Atorvastatin', 'Azithromycin',
  'Caffeine', 'Cephalexin', 'Ciprofloxacin', 'Clopidogrel', 'Diazepam', 'Diclofenac', 'Digoxin',
  'Doxycycline', 'Enalapril', 'Escitalopram', 'Furosemide', 'Gabapentin', 'Glibenclamide', 'Hydrochlorothiazide',
  'Ibuprofen', 'Insulin', 'Levothyroxine', 'Lisinopril', 'Loratadine', 'Losartan', 'Metformin', 'Methotrexate',
  'Metoprolol', 'Naproxen', 'Omeprazole', 'Paracetamol', 'Prednisone', 'Salbutamol', 'Sertraline', 'Simvastatin',
  'Tramadol', 'Vitamin D', 'Warfarin', 'Zinc',
  'Asthma', 'Atrial Fibrillation', 'Cholesterol', 'Depression', 'Diabetes Mellitus', 'Diabetes Mellitus, Type 2',
  'Hypertension', 'Hypothyroidism', 'Migraine Disorders', 'Obesity', 'Osteoporosis', 'Pneumonia', 'Stroke',
  'Anemia', 'Gout', 'Heart Failure', 'Kidney Failure, Chronic',
];

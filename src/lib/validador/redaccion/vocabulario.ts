/**
 * Palabras de tutelas de salud en Colombia que el diccionario general no trae (términos médicos y
 * jurídicos, medicamentos frecuentes, siglas escritas en minúscula y EPS). Se agregan al corrector
 * de corrector.ts para que no se marquen como errores. Si una palabra correcta aparece marcada,
 * agrégala aquí.
 */
const LISTA = `
accionante accionantes tutelante tutelantes subsidiariedad procedibilidad jurisprudencial
iusfundamental iusfundamentales vulnerador vulneradora vulneradores supersalud tutelaganas
sisbén sisben mipres pbs upc adres copago copagos multiafiliación desafiliación desafiliado
desafiliada cotizante cotizantes contrarreferencia teleconsulta telemedicina

hemodiálisis braquiterapia fonoaudiología fonoaudiólogo fonoaudióloga neuropsicología
neuropsicológica neuropsicológico glucometría glucometrías glucómetro glucómetros oxigenoterapia
nebulizaciones nebulizador ecocardiograma electromiografía mamografía mamografías colonoscopia
gastroscopia polisomnografía audiometría densitometría gammagrafía angiografía holter ortesis
órtesis antiescaras gastrostomía traqueostomía ostomía colostomía bariátrica artroplastia bypass
histerectomía mastectomía prostatectomía

oncólogo oncóloga oncólogos oncólogas oncología oncológico oncológica oncológicos oncológicas
hematología nefrólogo nefróloga nefrología neumólogo neumóloga neumología reumatólogo reumatóloga
reumatología endocrinología gastroenterólogo gastroenteróloga gastroenterología neuropediatra
neuropediatría fisiatra fisiatría otorrinolaringólogo otorrinolaringóloga otorrino optómetra
optometra urólogo uróloga ginecobstetra infectólogo infectóloga intensivista mastólogo mastóloga

seropositivo seropositiva vih epoc diabético diabética diabéticos hipertenso hipertensa
adenocarcinoma mieloma melanoma metastásico metastásica fibromialgia parkinson tdah hipoacusia
glaucoma retinopatía queratocono drepanocítica acv ictus

adalimumab metotrexato leflunomida rituximab trastuzumab pembrolizumab etanercept tocilizumab
infliximab imatinib tamoxifeno letrozol levotiroxina metformina enoxaparina warfarina rivaroxabán
apixabán atorvastatina losartán enalapril omeprazol esomeprazol pregabalina gabapentina tramadol
hidromorfona oxicodona acetaminofén ibuprofeno naproxeno dexametasona prednisolona prednisona
hidrocortisona levetiracetam valproato carbamazepina fenitoína lamotrigina topiramato risperidona
quetiapina olanzapina aripiprazol sertralina fluoxetina escitalopram metilfenidato salbutamol
budesonida beclometasona montelukast glargina lispro aspart

eps ips sanitas sura famisanar coosalud mutualser emssanar asmet capresoca comfenalco comfandi
comfama comfaoriente cajacopi aliansalud ecoopsos dusakawi anas wayuu pijaos colsubsidio
colsanitas medimás cafesalud saludvida
`;

export const VOCABULARIO_TUTELAS: readonly string[] = LISTA.split(/\s+/).filter(Boolean);

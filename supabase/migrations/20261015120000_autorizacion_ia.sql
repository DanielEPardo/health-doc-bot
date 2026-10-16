-- Autorización única para usar IA en la web (alcance 'ia'): se pide una vez, queda como prueba con
-- el texto del aviso aceptado y se puede retirar en «Mi perfil» → «Mis datos».
alter table consentimientos_web drop constraint if exists consentimientos_web_alcance_check;
alter table consentimientos_web add constraint consentimientos_web_alcance_check
  check (alcance in ('historial','documentos','terminos','ia'));

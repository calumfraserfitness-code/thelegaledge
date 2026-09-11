drop index if exists public.legal_consents_client_version_uidx;

create unique index legal_consents_client_version_uidx
  on public.legal_consents(client_id, document_version);

create unique index if not exists legal_consents_client_version_uidx
  on public.legal_consents(client_id,document_version)
  where document_version is not null;
create unique index if not exists onboarding_responses_client_version_uidx
  on public.onboarding_responses(client_id,version);

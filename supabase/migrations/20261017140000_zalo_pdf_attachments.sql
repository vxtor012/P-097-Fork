-- Add PDF snapshots only to the Zalo module. Existing text campaigns stay text-only.
ALTER TABLE public.zalo_campaigns ADD COLUMN attach_pdf boolean NOT NULL DEFAULT false;
ALTER TABLE public.zalo_deliveries ADD COLUMN pdf_data bytea;
ALTER TABLE public.zalo_deliveries ADD COLUMN pdf_name varchar(120);
ALTER TABLE public.zalo_deliveries ADD CONSTRAINT zalo_delivery_pdf_snapshot CHECK (
  (pdf_data IS NULL AND pdf_name IS NULL) OR
  (pdf_data IS NOT NULL AND pdf_name IS NOT NULL
   AND octet_length(pdf_data) BETWEEN 5 AND 1048576
   AND substring(pdf_data FROM 1 FOR 5)=decode('255044462d','hex')
   AND pdf_name ~ '^P97_BaoGia_[a-f0-9-]{36}\.pdf$')
);

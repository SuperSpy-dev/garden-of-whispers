UPDATE public.site_content
SET footer_paragraph = 'Please do not tell anyone about this website. If you share it with anyone, you will not receive any further information.'
WHERE id = 1
  AND footer_paragraph = 'Please do not tell anyone about this web. No new information will be provided.';
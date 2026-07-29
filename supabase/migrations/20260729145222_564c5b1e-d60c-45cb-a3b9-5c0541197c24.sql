WITH m AS (
  SELECT wi.item_id, w.pillar_id, w.name AS category,
         row_number() OVER (PARTITION BY wi.item_id ORDER BY w.name) rn
  FROM public.workstation_items wi
  JOIN public.workstations w ON w.id = wi.workstation_id
), pick AS (
  SELECT item_id, pillar_id, category FROM m WHERE rn = 1
), ord AS (
  SELECT p.item_id, p.pillar_id, p.category,
         row_number() OVER (PARTITION BY p.category ORDER BY ai.code) AS n
  FROM pick p JOIN public.audit_items ai ON ai.id = p.item_id
)
UPDATE public.audit_items ai
SET pillar_id = o.pillar_id,
    category = o.category,
    description = o.category || ' — point ' || o.n
FROM ord o
WHERE ai.id = o.item_id;
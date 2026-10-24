update public.payment_method_fees
   set variable_pct = 0,
       fixed_fee    = 0
 where method = 'pix';


alter function private.fn_meses_desde(date, date)                                     set search_path = public;
alter function private.fn_mes_corrente()                                              set search_path = public;
alter function private.fn_despesa_corre_em(expense_recurrence, date, date, int, date) set search_path = public;
alter function private.fn_parcelas_pagas_ate(date, int, date)                         set search_path = public;
alter function private.fn_ultima_parcela_em(date, int)                                set search_path = public;

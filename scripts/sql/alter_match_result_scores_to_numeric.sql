alter table match_results
  alter column match_score type numeric(5,2) using match_score::numeric(5,2),
  alter column ats_score type numeric(5,2) using ats_score::numeric(5,2);

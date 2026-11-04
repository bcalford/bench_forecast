-- Court sittings for the home page and scorecard groups: the hearing list a case is on ("November") and that
-- sitting's first and last argument day. Set by `npm run docket` when it files a case; `npm run docket -- sittings`
-- fills cases filed without one.
alter table cases
  add column sitting text,
  add column sitting_start date,
  add column sitting_end date;

# X Tournament Director — Mobile 2.4

## Finish-aware physical testing

Each test battle records:

- winning Bey;
- Spin, Over, Burst, or Xtreme finish;
- official point value;
- optional self-KO or launch-error context.

The learning model uses both battle reliability and finish quality. Higher-value
finishes receive more decision weight, while wins caused by an opponent's
self-KO receive less offensive credit.

Attack-category Bit versus Attack-category Bit testing remains excluded.

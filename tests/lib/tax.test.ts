import { estimateFederalTax, estimateRetirementTax, taxableSocialSecurity } from '@src/lib/tax';

describe('estimateFederalTax', () => {
  it('matches a hand-verified bracket walk for a single filer', () => {
    // $50,000 taxable, single, no inflation (factor 1):
    // 10% x 11,600 = 1,160
    // 12% x (47,150-11,600=35,550) = 4,266
    // 22% x (50,000-47,150=2,850) = 627
    // total = 6,053
    expect(estimateFederalTax(50000, 'single', 1)).toBeCloseTo(6053, 0);
  });

  it('taxes only the income within each bracket, not the whole amount at the top rate', () => {
    // Just $1 into the 12% bracket - should be barely more than the 10% bracket's flat $1,160.
    const justOver = estimateFederalTax(11601, 'single', 1);
    expect(justOver).toBeCloseTo(1160 + 0.12, 2);
  });

  it('is $0 for $0 or negative taxable income', () => {
    expect(estimateFederalTax(0, 'single', 1)).toBe(0);
    expect(estimateFederalTax(-5000, 'single', 1)).toBe(0);
  });

  it('married filing jointly has wider brackets than single at the same income', () => {
    const singleTax = estimateFederalTax(80000, 'single', 1);
    const marriedTax = estimateFederalTax(80000, 'marriedJoint', 1);
    expect(marriedTax).toBeLessThan(singleTax);
  });

  it('scales bracket thresholds up with the inflation factor, lowering tax on the same nominal income', () => {
    const noInflation = estimateFederalTax(50000, 'single', 1);
    const withInflation = estimateFederalTax(50000, 'single', 2);
    expect(withInflation).toBeLessThan(noInflation);
  });

  it('taxes the top (unbounded) bracket at its flat rate past the last threshold', () => {
    const veryHighIncome = 2000000;
    const tax = estimateFederalTax(veryHighIncome, 'single', 1);
    // Effective rate should approach but never reach 37% for a finite income with lower brackets below it.
    expect(tax / veryHighIncome).toBeLessThan(0.37);
    expect(tax / veryHighIncome).toBeGreaterThan(0.3);
  });
});

describe('taxableSocialSecurity', () => {
  it('is $0 below the lower provisional-income threshold', () => {
    // otherIncome=0, ssBenefit=20,000 -> provisional = 10,000, well under the single $25,000 floor.
    expect(taxableSocialSecurity(20000, 0, 'single')).toBe(0);
  });

  it('matches a hand-verified partial (50%-tier) calculation', () => {
    // otherIncome=20,000, ssBenefit=24,000 -> provisional = 20,000 + 12,000 = 32,000.
    // Between single thresholds (25,000/34,000): taxable = min(0.5*(32,000-25,000), 0.5*24,000)
    //   = min(3,500, 12,000) = 3,500.
    expect(taxableSocialSecurity(24000, 20000, 'single')).toBeCloseTo(3500, 0);
  });

  it('caps taxable Social Security at 85% of the benefit for high other income', () => {
    const result = taxableSocialSecurity(24000, 500000, 'single');
    expect(result).toBeCloseTo(0.85 * 24000, 0);
  });

  it('married filing jointly has higher thresholds, so the same income is taxed less', () => {
    const single = taxableSocialSecurity(24000, 20000, 'single');
    const married = taxableSocialSecurity(24000, 20000, 'marriedJoint');
    expect(married).toBeLessThan(single);
  });

  it('is $0 for a $0 benefit regardless of other income', () => {
    expect(taxableSocialSecurity(0, 100000, 'single')).toBe(0);
  });
});

describe('estimateRetirementTax', () => {
  it('combines taxable Social Security and Traditional withdrawal, minus the standard deduction, through the brackets', () => {
    const result = estimateRetirementTax({ traditionalWithdrawalAnnual: 20000, pensionAnnual: 0, ssBenefitAnnual: 24000, filingStatus: 'single', inflationFactor: 1 });
    expect(result.taxableSS).toBeCloseTo(3500, 0);
    expect(result.taxableOrdinaryIncome).toBeCloseTo(Math.max(0, 20000 + 3500 - 14600), 0);
    expect(result.tax).toBeCloseTo(estimateFederalTax(result.taxableOrdinaryIncome, 'single', 1), 6);
  });

  it('floors taxable ordinary income at $0 when the standard deduction exceeds the taxable sources', () => {
    const result = estimateRetirementTax({ traditionalWithdrawalAnnual: 5000, pensionAnnual: 0, ssBenefitAnnual: 0, filingStatus: 'single', inflationFactor: 1 });
    expect(result.taxableOrdinaryIncome).toBe(0);
    expect(result.tax).toBe(0);
  });

  it('computes an effective rate against total gross income (Traditional + Social Security)', () => {
    const result = estimateRetirementTax({ traditionalWithdrawalAnnual: 40000, pensionAnnual: 0, ssBenefitAnnual: 20000, filingStatus: 'single', inflationFactor: 1 });
    expect(result.effectiveRatePct).toBeCloseTo((result.tax / 60000) * 100, 6);
  });

  it('is a 0% effective rate when there is no income at all', () => {
    const result = estimateRetirementTax({ traditionalWithdrawalAnnual: 0, pensionAnnual: 0, ssBenefitAnnual: 0, filingStatus: 'single', inflationFactor: 1 });
    expect(result.effectiveRatePct).toBe(0);
  });

  it('scales the standard deduction with the inflation factor, same as the brackets', () => {
    const result = estimateRetirementTax({ traditionalWithdrawalAnnual: 20000, pensionAnnual: 0, ssBenefitAnnual: 0, filingStatus: 'single', inflationFactor: 2 });
    expect(result.standardDeduction).toBeCloseTo(14600 * 2, 6);
  });

  it("does NOT scale the Social Security taxability thresholds with inflation - they're fixed by real law", () => {
    // Same nominal Traditional withdrawal and Social Security benefit, but a much larger
    // inflationFactor (as if this were decades out): the standard deduction/brackets shift with it
    // (changing taxableOrdinaryIncome/tax), but taxableSS - which depends only on the fixed,
    // non-inflating thresholds - stays exactly the same.
    const nearTerm = estimateRetirementTax({ traditionalWithdrawalAnnual: 20000, pensionAnnual: 0, ssBenefitAnnual: 24000, filingStatus: 'single', inflationFactor: 1 });
    const farOut = estimateRetirementTax({ traditionalWithdrawalAnnual: 20000, pensionAnnual: 0, ssBenefitAnnual: 24000, filingStatus: 'single', inflationFactor: 3 });
    expect(farOut.taxableSS).toBe(nearTerm.taxableSS);
    expect(farOut.standardDeduction).not.toBe(nearTerm.standardDeduction);
  });

  it('treats pension income as fully ordinary, combined with Traditional withdrawal for both brackets and Social Security provisional income', () => {
    // Same total ordinary income ($20,000) split two different ways between Traditional and
    // pension should produce an identical result either way.
    const allTraditional = estimateRetirementTax({ traditionalWithdrawalAnnual: 20000, pensionAnnual: 0, ssBenefitAnnual: 24000, filingStatus: 'single', inflationFactor: 1 });
    const splitWithPension = estimateRetirementTax({ traditionalWithdrawalAnnual: 12000, pensionAnnual: 8000, ssBenefitAnnual: 24000, filingStatus: 'single', inflationFactor: 1 });
    expect(splitWithPension.taxableSS).toBeCloseTo(allTraditional.taxableSS, 6);
    expect(splitWithPension.taxableOrdinaryIncome).toBeCloseTo(allTraditional.taxableOrdinaryIncome, 6);
    expect(splitWithPension.tax).toBeCloseTo(allTraditional.tax, 6);
  });

  it('a pension-only household (no Traditional withdrawal) is still taxed as ordinary income', () => {
    const result = estimateRetirementTax({ traditionalWithdrawalAnnual: 0, pensionAnnual: 40000, ssBenefitAnnual: 0, filingStatus: 'single', inflationFactor: 1 });
    expect(result.taxableOrdinaryIncome).toBeCloseTo(40000 - 14600, 0);
    expect(result.tax).toBeGreaterThan(0);
  });
});

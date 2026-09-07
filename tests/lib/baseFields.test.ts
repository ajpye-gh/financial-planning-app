import { DEFAULT_BASE_RANGES } from '@src/lib/baseData';
import {
  ALL_BASE_FIELD_IDS,
  INSPECT_YEAR_FIELD,
  RETIREMENT_ROTH_CONTRIBUTION_FIELD,
  RETIREMENT_ROTH_SAVINGS_FIELD,
  RETIREMENT_ROTH_WITHDRAWAL_RATE_FIELD,
  RETIREMENT_SOCIAL_SECURITY_FIELD,
  RETIREMENT_TARGET_AGE_FIELD,
  RETIREMENT_TRADITIONAL_CONTRIBUTION_FIELD,
  RETIREMENT_TRADITIONAL_SAVINGS_FIELD,
  RETIREMENT_TRADITIONAL_WITHDRAWAL_RATE_FIELD,
  visibleBaseFieldGroups,
} from '@src/lib/baseFields';
import { MAX_PROJECTION_AGE } from '@src/lib/retirement';

function fieldIdsIn(title: string, groups: ReturnType<typeof visibleBaseFieldGroups>): string[] {
  return groups.find((group) => group.title === title)?.fields.map((field) => field.id) ?? [];
}

describe('visibleBaseFieldGroups', () => {
  it('hides home value/mortgage fields for a renter', () => {
    const groups = visibleBaseFieldGroups({ housing: 'rent' });
    const fieldIds = groups.flatMap((group) => group.fields.map((field) => field.id));

    expect(fieldIds).not.toContain('homeValueK');
    expect(fieldIds).not.toContain('mortgageBalanceK');
    expect(fieldIds).not.toContain('currentMortgageRatePct');
    expect(fieldIds).toContain('housingPaymentMo');
  });

  it('shows home value/mortgage fields under Assets for an owner', () => {
    const groups = visibleBaseFieldGroups({ housing: 'own' });

    expect(fieldIdsIn('Assets', groups)).toEqual(
      expect.arrayContaining(['homeValueK', 'mortgageBalanceK', 'currentMortgageRatePct', 'brokerageTodayK', 'cashTodayK']),
    );
  });

  it('no longer renders a manual "of which is P&I" slider - it is computed from the Mortgage tab inputs instead', () => {
    const fieldIds = visibleBaseFieldGroups({ housing: 'own' }).flatMap((group) => group.fields.map((field) => field.id));
    expect(fieldIds).not.toContain('housingPrincipalInterestMo');
  });

  it('mirrors Income as its own always-visible Partner income group - no questionnaire gating it anymore', () => {
    expect(fieldIdsIn('Partner income', visibleBaseFieldGroups({}))).toEqual([
      'partnerSalaryY0K',
      'partnerSalaryGrowthAfterY10Pct',
      'partnerNetKeepRatePct',
    ]);
  });

  it('always shows the cost-per-kid field under Expenses - no questionnaire gating it anymore', () => {
    expect(fieldIdsIn('Expenses', visibleBaseFieldGroups({}))).toEqual(expect.arrayContaining(['costPerKidMo']));
  });

  it('always includes all five groups, since each has at least one always-visible field', () => {
    const groups = visibleBaseFieldGroups({});
    expect(groups.map((group) => group.title)).toEqual([
      'Income',
      'Partner income',
      'Expenses',
      'Assets',
      'Assumptions',
    ]);
  });

  it('does not render inspectYear in any sidebar group - it is rendered separately, next to the results it controls', () => {
    const fieldIds = visibleBaseFieldGroups({}).flatMap((group) => group.fields.map((field) => field.id));
    expect(fieldIds).not.toContain('inspectYear');
    expect(INSPECT_YEAR_FIELD.id).toBe('inspectYear');
    expect(ALL_BASE_FIELD_IDS).toContain('inspectYear');
  });

  it('does not render the retirement fields in any primary-page sidebar group - they belong to the Retirement page instead', () => {
    const fieldIds = visibleBaseFieldGroups({}).flatMap((group) => group.fields.map((field) => field.id));
    expect(fieldIds).not.toContain('retirementRothSavingsTodayK');
    expect(fieldIds).not.toContain('retirementRothContributionMo');
    expect(fieldIds).not.toContain('retirementRothWithdrawalRatePct');
    expect(fieldIds).not.toContain('retirementTraditionalSavingsTodayK');
    expect(fieldIds).not.toContain('retirementTraditionalContributionMo');
    expect(fieldIds).not.toContain('retirementTraditionalWithdrawalRatePct');
    expect(fieldIds).not.toContain('retirementSocialSecurityMo');
    expect(fieldIds).not.toContain('retirementTargetAge');
    expect(ALL_BASE_FIELD_IDS).toEqual(
      expect.arrayContaining([
        RETIREMENT_ROTH_SAVINGS_FIELD.id,
        RETIREMENT_ROTH_CONTRIBUTION_FIELD.id,
        RETIREMENT_ROTH_WITHDRAWAL_RATE_FIELD.id,
        RETIREMENT_TRADITIONAL_SAVINGS_FIELD.id,
        RETIREMENT_TRADITIONAL_CONTRIBUTION_FIELD.id,
        RETIREMENT_TRADITIONAL_WITHDRAWAL_RATE_FIELD.id,
        RETIREMENT_SOCIAL_SECURITY_FIELD.id,
        RETIREMENT_TARGET_AGE_FIELD.id,
      ]),
    );
  });

  it("Inspect age's slider max stays in sync with retirement.ts's MAX_PROJECTION_AGE - both should always cap the projection/inspection window at the same age", () => {
    expect(DEFAULT_BASE_RANGES.retirementInspectAge.max).toBe(MAX_PROJECTION_AGE);
  });
});

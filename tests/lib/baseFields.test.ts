import { ALL_BASE_FIELD_IDS, INSPECT_YEAR_FIELD, visibleBaseFieldGroups } from '@src/lib/baseFields';

function fieldIdsIn(title: string, groups: ReturnType<typeof visibleBaseFieldGroups>): string[] {
  return groups.find((group) => group.title === title)?.fields.map((field) => field.id) ?? [];
}

describe('visibleBaseFieldGroups', () => {
  it('hides home value/mortgage fields for a renter', () => {
    const groups = visibleBaseFieldGroups({ housing: 'rent' });
    const fieldIds = groups.flatMap((group) => group.fields.map((field) => field.id));

    expect(fieldIds).not.toContain('homeValueK');
    expect(fieldIds).not.toContain('mortgageBalanceK');
    expect(fieldIds).not.toContain('housingPrincipalInterestMo');
    expect(fieldIds).toContain('housingPaymentMo');
  });

  it('shows home value/mortgage fields under Assets for an owner', () => {
    const groups = visibleBaseFieldGroups({ housing: 'own' });

    expect(fieldIdsIn('Assets', groups)).toEqual(
      expect.arrayContaining(['homeValueK', 'mortgageBalanceK', 'brokerageTodayK', 'cashTodayK']),
    );
    expect(fieldIdsIn('Expenses', groups)).toContain('housingPrincipalInterestMo');
  });

  it('always shows partner fields under Income - no questionnaire gating them anymore', () => {
    expect(fieldIdsIn('Income', visibleBaseFieldGroups({}))).toEqual(
      expect.arrayContaining(['partnerNetIncomeMo', 'partnerIncomeStopsYear']),
    );
  });

  it('always shows kid-cost fields under Expenses - no questionnaire gating them anymore', () => {
    expect(fieldIdsIn('Expenses', visibleBaseFieldGroups({}))).toEqual(
      expect.arrayContaining(['kidsAdded', 'costPerKidMo']),
    );
  });

  it('always includes all four groups, since each has at least one always-visible field', () => {
    const groups = visibleBaseFieldGroups({});
    expect(groups.map((group) => group.title)).toEqual(['Income', 'Expenses', 'Assets', 'Assumptions']);
  });

  it('does not render inspectYear in any sidebar group - it is rendered separately, next to the results it controls', () => {
    const fieldIds = visibleBaseFieldGroups({}).flatMap((group) => group.fields.map((field) => field.id));
    expect(fieldIds).not.toContain('inspectYear');
    expect(INSPECT_YEAR_FIELD.id).toBe('inspectYear');
    expect(ALL_BASE_FIELD_IDS).toContain('inspectYear');
  });
});

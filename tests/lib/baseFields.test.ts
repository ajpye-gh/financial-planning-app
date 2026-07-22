import { visibleBaseFieldGroups } from '@src/lib/baseFields';

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

  it('hides partner fields under Income until hasPartnerIncome is answered yes', () => {
    expect(fieldIdsIn('Income', visibleBaseFieldGroups({ hasPartnerIncome: false }))).not.toContain(
      'partnerNetIncomeMo',
    );
    expect(fieldIdsIn('Income', visibleBaseFieldGroups({ hasPartnerIncome: true }))).toEqual(
      expect.arrayContaining(['partnerNetIncomeMo', 'partnerIncomeStopsYear']),
    );
  });

  it('hides kid-cost fields under Expenses until hasKids is answered yes', () => {
    expect(fieldIdsIn('Expenses', visibleBaseFieldGroups({ hasKids: false }))).not.toContain('kidsAdded');
    expect(fieldIdsIn('Expenses', visibleBaseFieldGroups({ hasKids: true }))).toEqual(
      expect.arrayContaining(['kidsAdded', 'costPerKidMo']),
    );
  });

  it('always includes all four groups, since each has at least one always-visible field', () => {
    const groups = visibleBaseFieldGroups({});
    expect(groups.map((group) => group.title)).toEqual(['Income', 'Expenses', 'Assets', 'Assumptions']);
  });
});

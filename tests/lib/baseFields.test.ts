import { visibleBaseFieldGroups } from '@src/lib/baseFields';

describe('visibleBaseFieldGroups', () => {
  it('hides home value/mortgage fields for a renter', () => {
    const groups = visibleBaseFieldGroups({ housing: 'rent' });
    const fieldIds = groups.flatMap((group) => group.fields.map((field) => field.id));

    expect(fieldIds).not.toContain('homeValueK');
    expect(fieldIds).not.toContain('mortgageBalanceK');
    expect(fieldIds).not.toContain('housingPrincipalInterestMo');
    expect(fieldIds).toContain('housingPaymentMo');
  });

  it('shows home value/mortgage fields for an owner', () => {
    const groups = visibleBaseFieldGroups({ housing: 'own' });
    const fieldIds = groups.flatMap((group) => group.fields.map((field) => field.id));

    expect(fieldIds).toContain('homeValueK');
    expect(fieldIds).toContain('mortgageBalanceK');
    expect(fieldIds).toContain('housingPrincipalInterestMo');
  });

  it('drops the Household group entirely when it has no visible fields', () => {
    const groups = visibleBaseFieldGroups({ housing: 'rent', hasPartnerIncome: false, hasKids: false });
    expect(groups.some((group) => group.title === 'Household')).toBe(false);
  });

  it('includes the Household group once a partner or kids question is answered yes', () => {
    const groups = visibleBaseFieldGroups({ housing: 'rent', hasPartnerIncome: true, hasKids: false });
    const household = groups.find((group) => group.title === 'Household');

    expect(household).toBeDefined();
    expect(household?.fields.map((field) => field.id)).toEqual(['partnerNetIncomeMo', 'partnerIncomeStopsYear']);
  });

  it('always includes the always-on groups regardless of answers', () => {
    const groups = visibleBaseFieldGroups({});
    const titles = groups.map((group) => group.title);

    expect(titles).toEqual(expect.arrayContaining(["Today's position", 'Your salary path', 'Assumptions']));
  });
});

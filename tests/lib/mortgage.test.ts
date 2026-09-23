import {
  buildAmortizationSchedule,
  currentMonthlyPayment,
  formatPayoffDate,
  type MortgageScheduleInputs,
} from '@src/lib/mortgage';
import { monthlyMortgagePayment } from '@src/lib/model';

const BASE_INPUTS: MortgageScheduleInputs = {
  loanAmount: 300000,
  annualRatePct: 6,
  termYears: 30,
  homeValue: 400000,
  appreciationPct: 3,
  monthlyInsurance: 0,
};

describe('buildAmortizationSchedule', () => {
  it('computes the same fixed P&I payment as monthlyMortgagePayment', () => {
    const schedule = buildAmortizationSchedule(BASE_INPUTS);
    expect(schedule.monthlyPaymentPI).toBeCloseTo(monthlyMortgagePayment(300000, 6, 30), 6);
  });

  it('starts at a Y0 baseline with the full loan amount, no payments yet', () => {
    const schedule = buildAmortizationSchedule(BASE_INPUTS);
    expect(schedule.points[0]).toEqual({
      year: 0,
      openingBalance: 300000,
      closingBalance: 300000,
      principalPaid: 0,
      interestPaid: 0,
      insurancePaid: 0,
      insuranceActive: false,
      monthlyPaymentNominal: schedule.monthlyPaymentPI,
    });
  });

  it('fully amortizes to a $0 balance within the loan term', () => {
    const schedule = buildAmortizationSchedule(BASE_INPUTS);
    const lastPoint = schedule.points[schedule.points.length - 1];
    expect(lastPoint.closingBalance).toBe(0);
    expect(schedule.payoffMonths).toBeLessThanOrEqual(30 * 12);
    expect(schedule.payoffMonths).toBeGreaterThan(29 * 12);
  });

  it('is $0 across the board for a zero or already-paid-off loan', () => {
    const schedule = buildAmortizationSchedule({ ...BASE_INPUTS, loanAmount: 0 });
    expect(schedule.monthlyPaymentPI).toBe(0);
    expect(schedule.payoffMonths).toBe(0);
    expect(schedule.points).toEqual([
      {
        year: 0,
        openingBalance: 0,
        closingBalance: 0,
        principalPaid: 0,
        interestPaid: 0,
        insurancePaid: 0,
        insuranceActive: false,
        monthlyPaymentNominal: 0,
      },
    ]);
  });

  it('each year opens where the previous year closed (continuous balance across points)', () => {
    const schedule = buildAmortizationSchedule(BASE_INPUTS);
    for (let i = 1; i < schedule.points.length; i++) {
      expect(schedule.points[i].openingBalance).toBeCloseTo(schedule.points[i - 1].closingBalance, 6);
    }
  });

  it('each year, opening minus principal paid equals closing balance', () => {
    const schedule = buildAmortizationSchedule(BASE_INPUTS);
    for (const point of schedule.points.slice(1)) {
      expect(point.openingBalance - point.principalPaid).toBeCloseTo(point.closingBalance, 6);
    }
  });

  describe('extra principal payments', () => {
    it('shortens the payoff time compared to the schedule with no extra payment', () => {
      const withoutExtra = buildAmortizationSchedule(BASE_INPUTS);
      const withExtra = buildAmortizationSchedule({ ...BASE_INPUTS, extraMonthlyPrincipal: 500 });

      expect(withExtra.payoffMonths).toBeLessThan(withoutExtra.payoffMonths);
    });

    it('reduces total interest paid over the life of the loan', () => {
      const withoutExtra = buildAmortizationSchedule(BASE_INPUTS);
      const withExtra = buildAmortizationSchedule({ ...BASE_INPUTS, extraMonthlyPrincipal: 500 });

      const totalInterest = (schedule: ReturnType<typeof buildAmortizationSchedule>) =>
        schedule.points.reduce((sum, point) => sum + point.interestPaid, 0);

      expect(totalInterest(withExtra)).toBeLessThan(totalInterest(withoutExtra));
    });

    it('does not change the required (non-extra) P&I payment amount itself', () => {
      const withoutExtra = buildAmortizationSchedule(BASE_INPUTS);
      const withExtra = buildAmortizationSchedule({ ...BASE_INPUTS, extraMonthlyPrincipal: 500 });

      expect(withExtra.monthlyPaymentPI).toBe(withoutExtra.monthlyPaymentPI);
    });

    it('never pays off later than the original schedule, even with a small extra amount', () => {
      const withoutExtra = buildAmortizationSchedule(BASE_INPUTS);
      const withSmallExtra = buildAmortizationSchedule({ ...BASE_INPUTS, extraMonthlyPrincipal: 10 });

      expect(withSmallExtra.payoffMonths).toBeLessThanOrEqual(withoutExtra.payoffMonths);
    });
  });

  describe('mortgage insurance drop-off at 20% equity', () => {
    it('charges insurance in early years when equity is below 20%', () => {
      // $400k home, $300k loan => 25% equity today already... use a higher loan to start under 20%.
      const schedule = buildAmortizationSchedule({ ...BASE_INPUTS, loanAmount: 340000, monthlyInsurance: 150 });
      expect(schedule.points[1].insurancePaid).toBeCloseTo(150 * 12, 6);
    });

    it('drops insurance once projected equity crosses 20%, for that and all subsequent years', () => {
      const schedule = buildAmortizationSchedule({ ...BASE_INPUTS, loanAmount: 340000, monthlyInsurance: 150, appreciationPct: 0 });

      // Find the first year with $0 insurance paid.
      const firstZeroInsuranceIndex = schedule.points.findIndex((point, index) => index > 0 && point.insurancePaid === 0);
      expect(firstZeroInsuranceIndex).toBeGreaterThan(0);

      // Every year from there on should also be $0 - insurance never comes back once dropped.
      for (const point of schedule.points.slice(firstZeroInsuranceIndex)) {
        expect(point.insurancePaid).toBe(0);
      }

      // And every year before that should have some insurance paid.
      for (const point of schedule.points.slice(1, firstZeroInsuranceIndex)) {
        expect(point.insurancePaid).toBeGreaterThan(0);
      }
    });

    it('never charges insurance at all when starting equity is already at/above 20%', () => {
      // $400k home, $300k loan = 25% equity today.
      const schedule = buildAmortizationSchedule({ ...BASE_INPUTS, monthlyInsurance: 150 });
      for (const point of schedule.points) {
        expect(point.insurancePaid).toBe(0);
      }
    });

    it('has no effect on principal/interest paydown - insurance is additive, not part of the amortization', () => {
      const noInsurance = buildAmortizationSchedule({ ...BASE_INPUTS, loanAmount: 340000, monthlyInsurance: 0 });
      const withInsurance = buildAmortizationSchedule({ ...BASE_INPUTS, loanAmount: 340000, monthlyInsurance: 150 });

      expect(withInsurance.payoffMonths).toBe(noInsurance.payoffMonths);
      expect(withInsurance.points[1].principalPaid).toBeCloseTo(noInsurance.points[1].principalPaid, 6);
    });
  });

  describe('monthlyPaymentNominal', () => {
    it("matches currentMonthlyPayment at the year-0 baseline", () => {
      const inputs = { ...BASE_INPUTS, monthlyPropertyTax: 300, monthlyHomeInsurance: 120 };
      const schedule = buildAmortizationSchedule(inputs);
      expect(schedule.points[0].monthlyPaymentNominal).toBeCloseTo(currentMonthlyPayment(inputs), 6);
    });

    it('grows property tax and home insurance by appreciationPct each year, on top of the flat P&I payment', () => {
      const schedule = buildAmortizationSchedule({ ...BASE_INPUTS, monthlyPropertyTax: 300, monthlyHomeInsurance: 120, appreciationPct: 3 });
      const yearOnePoint = schedule.points[1];
      const expectedTaxAndInsurance = (300 + 120) * 1.03;
      expect(yearOnePoint.monthlyPaymentNominal).toBeCloseTo(schedule.monthlyPaymentPI + expectedTaxAndInsurance, 2);
    });

    it('marks insurance inactive at year 0 once starting equity is already at/above 20% (not just $0 paid)', () => {
      const schedule = buildAmortizationSchedule({ ...BASE_INPUTS, monthlyInsurance: 150 });
      expect(schedule.points[0].insuranceActive).toBe(false);
    });

    it('marks insurance active at year 0 when starting equity is below 20%', () => {
      const schedule = buildAmortizationSchedule({ ...BASE_INPUTS, loanAmount: 340000, monthlyInsurance: 150 });
      expect(schedule.points[0].insuranceActive).toBe(true);
    });
  });
});

describe('currentMonthlyPayment', () => {
  it('is the required P&I payment alone when there is no insurance or extra principal', () => {
    expect(currentMonthlyPayment(BASE_INPUTS)).toBeCloseTo(monthlyMortgagePayment(300000, 6, 30), 6);
  });

  it('adds insurance when starting equity is below 20%', () => {
    const payment = currentMonthlyPayment({ ...BASE_INPUTS, loanAmount: 340000, monthlyInsurance: 150 });
    expect(payment).toBeCloseTo(monthlyMortgagePayment(340000, 6, 30) + 150, 6);
  });

  it('excludes insurance when starting equity is already at/above 20%', () => {
    const payment = currentMonthlyPayment({ ...BASE_INPUTS, monthlyInsurance: 150 });
    expect(payment).toBeCloseTo(monthlyMortgagePayment(300000, 6, 30), 6);
  });

  it('adds any extra principal on top', () => {
    const payment = currentMonthlyPayment({ ...BASE_INPUTS, extraMonthlyPrincipal: 200 });
    expect(payment).toBeCloseTo(monthlyMortgagePayment(300000, 6, 30) + 200, 6);
  });

  it('is $0 for a paid-off loan', () => {
    expect(currentMonthlyPayment({ ...BASE_INPUTS, loanAmount: 0 })).toBe(0);
  });
});

describe('formatPayoffDate', () => {
  it('adds the month count onto the given start date', () => {
    const from = new Date(2026, 0, 15); // Jan 2026
    expect(formatPayoffDate(6, from)).toBe('Jul 2026');
  });

  it('rolls over into the next year(s) correctly', () => {
    const from = new Date(2026, 10, 1); // Nov 2026
    expect(formatPayoffDate(4, from)).toBe('Mar 2027');
  });

  it('handles a payoff many years out', () => {
    const from = new Date(2026, 0, 1);
    expect(formatPayoffDate(360, from)).toBe('Jan 2056');
  });

  it('reports "Paid off" for a $0 or already-elapsed payoff', () => {
    expect(formatPayoffDate(0)).toBe('Paid off');
    expect(formatPayoffDate(-5)).toBe('Paid off');
  });
});

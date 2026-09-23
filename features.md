1. Feat: improve all sliders. They should all use a reusable component, if they do not already. Allow user to double-click lower and upper bound, which allows them to dynamically change the limits. Also, allow user to double-click the slider cursor to input a new value from keyboard, rather than sliding to find it. 
1. Fix: cash savings should have their own growth rules/controls, such that "emergency fund" only grows by certain % each year. this can be a slider next to inflation rate that goes from 0 to 5% in increments of .1%.
1. Fix: "use home equity" should not be selectable for first home purchase
1. Feat: improve mortgage input section.
    - add new tab for mortgage, between primary tab and retirement tab
    - Switch to standard mortgage inputs (mortgage rate, loan term, etc)
    - Include mortgage insurance as an input value. Assume mortgage insurance is removed after reaching 20% equity.
    - The chart on this page should show an amortization schedule, which would be calculated based on user inputs
    - Add slider for monthly extra principal or one-time payment to decrease length of loan
    - Chart shows original amortization vs amortization with extra payments
    - Should show pay off date
    - all of this info should roll up into the primary financial calculator as it does now, so that home equity can be used on future goals. Sidebar should show mortgage summary (current monthly payment and remaining principal).
    - Continue to grow monthly payment with inflation, but do not express it as "of which is P&I". 
1. Feat: Improve retirement page
    - Although 4% withdraw is standard retirement calculator, users are much more likely to resonate with a fixed dollar amount - monthly income. This also makes it easier to understand how inflation is impacting the calculation. Therefore, make dollar value the primary driver, with % as a secondary value (in parentheses). 
    - Make social security totally optional
1. Fix: yearly income and raises unclear. Allow user to input the new income, not how much the raise was. For example, if user has income of 100,000 and they expect a raise of 5,000 in year 2, then they would input 105,000 rather than 5,000. 
1. Feat: include yearly bonus input
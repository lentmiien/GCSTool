# Case Tracker Usage Guide

## Purpose

The Case Tracker records complaint and claim information in a consistent format so that it can be used for reporting and analytics. It complements FileMaker; continue adding the usual case notes in FileMaker.

The tool is available at `/ct`.

## Standard workflow

1. Receive a customer complaint.
2. Open the order in FileMaker and add notes as usual.
3. Open `/ct` and enter the order number under **Open Case**.
   - If the order does not have a case yet, a new case is created.
   - If a case already exists, the existing case is opened.
4. Enter the available case information and select **Save case**.
5. Return to the case and update it whenever:
   - the customer provides information that was missing from the initial contact;
   - the affected item or defect becomes clear;
   - a decision is made about the assistance to provide; or
   - assistance is completed and the case can be closed.

Keeping cases up to date is important. The quality of the analytics depends on the completeness and accuracy of the saved information.

## Completing a case

Fields marked with an asterisk (`*`) are required. The required fields may change when a different complaint type is selected.

- **Customer ID:** Enter the customer's ID so the tool can identify repeat customers and display their other cases.
- **Complaint date:** Enter the date on which the complaint was received.
- **Customer complaint:** Select the complaint or claim type that best describes the case.
- **Complaint edit:** If the original classification later proves incorrect, select the corrected complaint type here. The original classification remains recorded.
- **Complaint comment:** Summarize the overall case. Explain what the customer is complaining about, why the case is being reviewed, and any relevant history, such as a complaint about a replacement item from an earlier exchange.
- **Shipping method and shipping date:** Complete these when relevant to the selected complaint type.
- **Defect items:** Add each item as a separate row using its item code and a description of that item's defect. Use **Edit** or **Delete** to correct a row.
  - If the item is required but the customer has not identified it yet, select **Item not confirmed yet**.
  - When a real item is added later, the temporary placeholder is removed automatically.
- **Solution:** Select the assistance or outcome decided for the case.
- **Solved date:** Enter this when assistance has been completed. A solution is required before the case can be closed.

Do not guess missing details. Save the information that is known, use the item placeholder when appropriate, and update the case when the customer clarifies the situation.

## What the tool helps us understand

Consistent case records make it possible to:

- notice repeat customers while handling a new case;
- identify items appearing in multiple defect cases and, in rare cases with an unusually high number of problems, provide evidence for escalation to the maker;
- monitor complaint and defect trends over time;
- compare complaint or claim types with their solutions;
- measure processing time for different types of claims;
- measure the delay between shipment and the customer's complaint; and
- see where missing data is reducing the reliability of an analysis.

Without structured records, these questions cannot be answered reliably. The Case Tracker gives us a foundation for understanding and improving the claim process, and the recorded data can be extended as our reporting needs develop.

## Planned additions

The following features are ideas for future development and are not yet available:

- Link lost claims with the tracking database.
- Highlight shipments delivered after a claim was started so they can be followed up.
- Warn when an undelivered shipment is approaching the carrier's complaint deadline.
- Record assistance costs for richer cost and outcome analysis.

## Administration

Administrators can use `/ct/admin` to manage:

- complaint types and the fields required for each type;
- available shipping methods; and
- available solution types.

Using these configured options keeps case data consistent and avoids spelling variations in reports.

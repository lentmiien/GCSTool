# Case Tracker Usage Guide

## Purpose

The Case Tracker records complaint and claim information in a consistent format so that it can be used for reporting and analytics. It complements FileMaker; continue adding the usual detailed case notes and order-processing steps in FileMaker.

The tool is available at `/ct`.

The current goal is a lightweight record of when a claim starts, the information needed for its type, and how and when it is completed. It is not necessary to copy the full FileMaker history into the Case Tracker.

## Minimum expected workflow

1. Receive a customer complaint.
2. Open the order in FileMaker and add notes as usual.
3. Open `/ct` and enter the order number under **Open Case**.
   - If the order does not have a case yet, a new case is created and assigned to you.
   - If a case already exists, the existing case is opened.
4. Select the complaint type, enter the information currently available, and select **Save case**.
5. For a defect claim, add the item code and a short defect description. This can be added later if it was not clear from the customer's first message.
6. Return to the case when there is a meaningful update, such as:
   - the customer provides important missing information;
   - the affected item or defect becomes clear;
   - a decision is made about the assistance to provide; or
   - assistance is completed and the case can be closed.
7. Select the solution and enter the solved date when the case is finished.

During a busy period, it is fine to create the case when the response starts and complete or close the record later during downtime. Intermediate updates are useful when the information affects the structured case data, but a separate entry is not needed for every customer message.

## Staff in charge

- A new case defaults to the logged-in user who creates it.
- The `/ct` landing page first shows your open cases, with the cases that have gone the longest without an update at the top.
- Completed cases are hidden from the landing-page work lists. They remain available by opening their order number and remain included in analytics.
- Open cases assigned to other staff, and older unassigned cases, are available in the expandable list at the bottom of the landing page.
- Everyone can view and edit every case. If you begin working on a case assigned to someone else, use **Take case** to assign it to yourself immediately.
- You can also select another user under **Staff in charge** and then select **Save case**.
- If the original staff member is away, another staff member only needs to update the case if they work on it. They should take the case when they become responsible for continuing it.

The ownership list is intended to make unfinished work easier to review and reduce the chance that an open case is forgotten.

## Field guidance

Fields marked with an asterisk (`*`) are required. The required fields change with the selected complaint type.

- **Customer ID:** Enter the customer's ID so the tool can identify repeat customers and display their other cases.
- **Complaint date:** Enter the date on which the complaint was received.
- **Customer complaint:** Select the complaint or claim type that best describes the case.
- **Complaint edit:** If the original classification later proves incorrect, select the corrected complaint type here. The original classification remains recorded.
- **Complaint comment:** This is optional for the current complaint types. Use it for unusual circumstances or useful context that is not already clear, such as a persistent or difficult situation, a case that required internal consultation, or relevant history. There is no need to repeat a self-explanatory lost-package claim or the defect descriptions entered with the items.
- **Shipping method and shipping date:** These are required for shipping-related claims, including lost or shipping-damaged claims. They are also required for missing- or wrong-content claims because mix-ups may be connected to the same shipping batch.
- **Defect items:** These are required only for defect claims. Add each affected item as a separate row with its item code and a short description of that item's defect. This data is used to find items with recurring problems.
  - Do not list every item simply because a parcel or order was damaged. Item rows are for identifying defects in particular items.
  - If several items have defects, add one row for each affected item. Unaffected items do not need to be entered.
  - Use **Edit** or **Delete** to correct an item row.
  - If an item is required but the customer has not identified it yet, select **Item not confirmed yet**.
  - When a real item is added later, the temporary placeholder is removed automatically.
- **Solution:** Select the assistance or outcome decided for the case.
- **Solved date:** Enter this when the assistance is complete and the case is closed. It does not need to be perfectly precise; if the record is closed later during downtime, using that closing date is fine. A solution is required before the case can be closed.

Do not guess missing details. Save what is known, use the item placeholder when appropriate, and add the missing structured information when it becomes available.

## Correcting mistakes

- If an item or description is incorrect, use the row's **Edit** or **Delete** button.
- If the complaint type is incorrect, use **Complaint edit**.
- If the case was created with the wrong order number, use **Delete case** on the case details page, confirm the permanent deletion, and then create a case with the correct order number.

Deleting a case permanently removes it from the Case Tracker and its analytics, so it should only be used for an incorrect order number, a duplicate, or a case created by mistake.

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

## Planned additions and longer-term possibilities

The following features are ideas for future development and are not yet available:

- Link lost claims with the tracking database.
- Highlight shipments delivered after a claim was started so they can be followed up.
- Warn when an undelivered shipment is approaching the carrier's complaint deadline.
- Record assistance costs for richer cost and outcome analysis.
- Add reminders or other review signals for cases that may need attention.

The current intent is still to use FileMaker for normal claim notes and order-processing work such as returns and replacement shipments. If the Case Tracker eventually becomes useful enough to make claim handling easier and faster, it may be possible to move more of the claim process into it in the future, but that is not required for the current trial.

## Administration

Administrators can use `/ct/admin` to manage:

- complaint types and the fields required for each type;
- available shipping methods; and
- available solution types.

Using these configured options keeps case data consistent and avoids spelling variations in reports.

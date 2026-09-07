# 05: Edit and delete a device

**What to build:** a project admin who named a device wrongly, ticked the wrong metrics, or bound
the wrong element can fix it — without asking anyone to run a query.

Until this ticket, a binding is permanent. That makes the whole feature risky to use: the first
mis-click becomes a wrong device visible to the entire project forever, and users respond to that by
not using the feature.

An admin can change a device's label, its metrics, and its device code — the last of which is the
one most likely to be filled in later, once the real IoT system is known and its identifiers are to
hand. Changing the metric set must take effect in the right panel immediately: charts for removed
metrics disappear, charts for added ones appear.

An admin can delete a device. Deletion is permanent, matching the shop-drawings precedent rather than
the clash tables' soft delete, and the reason is concrete: a soft-deleted row would keep occupying
the one-device-per-element rule, so a user correcting a mis-binding could never re-bind that element
— which is precisely the action that follows a mistake. **Re-binding a deleted element must work**,
and it is worth verifying explicitly rather than assuming.

Deletion is destructive and shared, so it needs a confirmation that names what is about to be
removed. It must not use a browser dialog — those block the automation this project tests with.

The device that was deleted should also stop being selected: the right panel cannot keep describing
something that no longer exists.

Editing and deleting are offered to project admins only, consistent with binding. A member sees the
device and its data, and no controls.

**Blocked by:** 03 (devices must exist to be edited).

**Status:** ready-for-agent

- [ ] An admin can change a device's label and see it update in the list
- [ ] An admin can add and remove metrics, and the right panel's charts follow immediately
- [ ] An admin can fill in or change the device code
- [ ] A device code that collides with another device in the same project is rejected with a reason
- [ ] An admin can delete a device after a confirmation that names it
- [ ] The confirmation is in-page, not a browser dialog
- [ ] A deleted device disappears from the list without a page reload
- [ ] Deleting the selected device clears the right panel rather than leaving it describing nothing
- [ ] The element of a deleted device can be bound again immediately
- [ ] A re-bound element behaves as a new device, with its own values
- [ ] A non-admin sees no edit or delete controls
- [ ] The typecheck, the lint and the production build pass

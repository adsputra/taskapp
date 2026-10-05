import { test, expect } from "@playwright/test";
import { addTask, createBoard, hasBackend, restSelect, signUp, uniqueEmail } from "./helpers.mjs";

test.describe("board collaboration", () => {
  test.skip(!hasBackend, "needs NEXT_PUBLIC_SUPABASE_URL / ANON_KEY");

  test("invite an editor, who can add tasks, comment and @mention; owner is notified", async ({ browser }) => {
    const ownerEmail = uniqueEmail("owner");
    const editorEmail = uniqueEmail("editor");
    const ownerHandle = ownerEmail.split("@")[0];
    const boardTitle = `Launch ${Date.now()}`;

    // ── Owner sets up a board ──
    const ownerContext = await browser.newContext();
    const owner = await ownerContext.newPage();
    await signUp(owner, { name: "Olivia Owner", email: ownerEmail });
    await expect(owner).toHaveURL(/\/boards/);
    const boardId = await createBoard(owner, boardTitle);
    await addTask(owner, "Write launch plan");

    // The audit trail is written by the database.
    await owner.getByRole("button", { name: "Write launch plan", exact: true }).click();
    const drawer = owner.getByRole("dialog");
    await drawer.getByRole("tab", { name: "Activity" }).click();
    await expect(drawer.getByText("created task")).toBeVisible();
    await drawer.getByRole("button", { name: "Close task details" }).click();

    // ── Invite ──
    await owner.getByRole("button", { name: "Share" }).first().click();
    await owner.getByLabel("Email address to invite").fill(editorEmail);
    await owner.getByRole("button", { name: "Invite" }).click();
    const inviteLink = await owner.getByRole("textbox", { name: "Invite link" }).inputValue();
    expect(inviteLink).toMatch(/\/join\?token=/);
    await owner.keyboard.press("Escape");

    // Visibility is derived by the database.
    const { body: boards } = await restSelect(ownerContext, "boards", `select=visibility&id=eq.${boardId}`);
    expect(boards[0].visibility).toBe("shared");

    // ── Editor joins ──
    const editorContext = await browser.newContext();
    const editor = await editorContext.newPage();
    const joinPath = new URL(inviteLink).pathname + new URL(inviteLink).search;
    await signUp(editor, { name: "Eddie Editor", email: editorEmail, redirect: joinPath });
    await expect(editor).toHaveURL(/\/join\?token=/);
    await editor.getByRole("button", { name: /Terima Undangan/ }).click();
    await editor.getByRole("button", { name: "Buka Board" }).click();
    await expect(editor.getByRole("heading", { level: 1, name: boardTitle })).toBeVisible();

    // Editors can now add tasks (used to be admin-only).
    await addTask(editor, "Draft press release");

    // Editors cannot delete tasks, so the button is not offered.
    await editor.getByRole("button", { name: "Write launch plan", exact: true }).click();
    const editorDrawer = editor.getByRole("dialog");
    await expect(editorDrawer.getByRole("button", { name: "Delete task" })).toHaveCount(0);

    // Comment with an @mention picked from the suggestions.
    await editorDrawer.getByRole("tab", { name: "Comments" }).click();
    const box = editorDrawer.getByLabel("Write a comment");
    await box.fill("Looks good @");
    await box.pressSequentially(ownerHandle.slice(0, 5));
    await editorDrawer.getByRole("option", { name: new RegExp(ownerHandle) }).click();
    await box.pressSequentially("please review");
    await box.press("Enter");
    await expect(editorDrawer.getByText(`@${ownerHandle}`)).toBeVisible();

    // ── Owner is notified ──
    await owner.reload();
    const bell = owner.getByRole("button", { name: /Notifications, \d+ unread/ }).first();
    await expect(bell).toBeVisible();
    await bell.click();
    await expect(owner.getByText("Invitation accepted")).toBeVisible();
    await expect(owner.getByText("You were mentioned")).toBeVisible();

    // Clicking the mention opens the task straight from the notification.
    await owner.getByText("You were mentioned").click();
    await expect(owner).toHaveURL(new RegExp(`/boards/${boardId}\\?.*task=`));
    await expect(owner.getByRole("dialog").getByRole("heading", { name: "Write launch plan" })).toBeVisible();

    // Assign the editor from the drawer's Owner field; they get notified.
    const ownerDrawer = owner.getByRole("dialog");
    await ownerDrawer.getByRole("tab", { name: "Details" }).click();
    await ownerDrawer.getByRole("button", { name: /^Assignees:/ }).click();
    await owner.getByRole("option", { name: new RegExp(editorEmail) }).click();
    await owner.keyboard.press("Escape");
    await expect(ownerDrawer.getByRole("button", { name: /^Assignees: Eddie Editor/ })).toBeVisible();

    await editor.reload();
    // The open task survives the reload (?task= in the URL); close it first.
    await expect(editor.getByRole("dialog")).toBeVisible();
    await editor.keyboard.press("Escape");
    await editor.getByRole("button", { name: /Notifications, \d+ unread/ }).first().click();
    await expect(editor.getByText("You were assigned a task")).toBeVisible();

    await ownerContext.close();
    await editorContext.close();
  });
});

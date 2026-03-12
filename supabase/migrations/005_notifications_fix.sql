-- SignalDesk AI - Fix Notifications Table
-- Makes user_id nullable to support workspace-level notifications
-- (e.g. daily digests, payment failures) that aren't tied to a single user.
-- Updates RLS so workspace members can see workspace notifications.

-- Allow workspace-level notifications without a specific user_id
ALTER TABLE public.notifications
  ALTER COLUMN user_id DROP NOT NULL;

-- Drop existing RLS policy and replace with one that covers both cases
DROP POLICY IF EXISTS "Users can manage own notifications" ON public.notifications;

-- Users can see their own personal notifications
CREATE POLICY "Users can view own notifications" ON public.notifications
  FOR SELECT USING (
    user_id = auth.uid()
    OR workspace_id IN (
      SELECT workspace_id FROM public.workspace_members WHERE user_id = auth.uid()
    )
  );

-- Users can insert their own notifications
CREATE POLICY "Users can insert notifications" ON public.notifications
  FOR INSERT WITH CHECK (
    user_id = auth.uid()
    OR workspace_id IN (
      SELECT workspace_id FROM public.workspace_members WHERE user_id = auth.uid()
    )
  );

-- Users can update (mark as read) their own or workspace notifications
CREATE POLICY "Users can update notifications" ON public.notifications
  FOR UPDATE USING (
    user_id = auth.uid()
    OR workspace_id IN (
      SELECT workspace_id FROM public.workspace_members WHERE user_id = auth.uid()
    )
  );

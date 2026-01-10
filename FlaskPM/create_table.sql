-- Run this in your Supabase SQL Editor to fix the missing table error.

CREATE TABLE IF NOT EXISTS project_members (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    role TEXT DEFAULT 'Member' CHECK (role IN ('Manager', 'Member', 'Viewer')),
    joined_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()),
    UNIQUE(project_id, user_id)
);

-- Enable RLS (Optional but recommended)
ALTER TABLE project_members ENABLE ROW LEVEL SECURITY;

-- Policy: Users can view their own memberships
CREATE POLICY "Users can view own memberships" ON project_members
    FOR SELECT USING (auth.uid() = user_id);

-- Policy: Project Managers/Admins can manage members (Simplified)
-- For now, allow authenticated users to insert (backend handles logic)
CREATE POLICY "Enable insert for authenticated users only" ON "public"."project_members"
AS PERMISSIVE FOR INSERT
TO authenticated
WITH CHECK (true);

-- Policy: Enable select for all authenticated users (since backend checks logic)
CREATE POLICY "Enable select for authenticated users only" ON "public"."project_members"
AS PERMISSIVE FOR SELECT
TO authenticated
USING (true);

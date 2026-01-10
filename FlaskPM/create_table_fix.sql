-- It seems your 'projects' table uses BIGINT (int8) for IDs, not UUID.
-- We are adjusting the project_members table to match that.

CREATE TABLE IF NOT EXISTS project_members (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    project_id BIGINT REFERENCES projects(id) ON DELETE CASCADE, -- Changed to BIGINT
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,       -- keeping UUID for users (standard Supabase)
    role TEXT DEFAULT 'Member' CHECK (role IN ('Manager', 'Member', 'Viewer')),
    joined_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()),
    UNIQUE(project_id, user_id)
);

-- Enable RLS
ALTER TABLE project_members ENABLE ROW LEVEL SECURITY;

-- Allow all access for now (or strictly backend authenticated)
CREATE POLICY "Enable access for all users" ON project_members FOR ALL USING (true);

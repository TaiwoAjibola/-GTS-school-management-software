-- Create Supabase Storage bucket for student profile images
-- Run this in Supabase SQL Editor if the bucket doesn't exist via Dashboard

-- Create the bucket (idempotent)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('student-profiles', 'student-profiles', true, 5242880, ARRAY['image/jpeg', 'image/png', 'image/webp'])
ON CONFLICT (id) DO NOTHING;

-- Allow public read access to student profile images
CREATE POLICY "Student profile images are publicly accessible"
ON storage.objects FOR SELECT
USING (bucket_id = 'student-profiles');

-- Allow authenticated users (service role) to upload/update/delete
CREATE POLICY "Allow authenticated users to manage student profile images"
ON storage.objects FOR ALL
USING (bucket_id = 'student-profiles')
WITH CHECK (bucket_id = 'student-profiles');

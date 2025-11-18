-- Function to get user information from auth.users
-- This function can be called via RPC to get user email/name
CREATE OR REPLACE FUNCTION get_user_info(user_ids uuid[])
RETURNS TABLE (
  id uuid,
  email varchar(255),
  full_name text
) 
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    au.id,
    au.email,
    COALESCE(
      au.raw_user_meta_data->>'full_name',
      au.raw_user_meta_data->>'name',
      split_part(au.email, '@', 1),
      au.email,
      'Unknown User'
    )::text as full_name
  FROM auth.users au
  WHERE au.id = ANY(user_ids);
END;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION get_user_info(uuid[]) TO authenticated;
GRANT EXECUTE ON FUNCTION get_user_info(uuid[]) TO anon;

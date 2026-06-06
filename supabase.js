import { createClient } from "@supabase/supabase-js";

const supabaseUrl = "https://ltuepchgoxagpquwalbi.supabase.co";
const supabaseKey =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imx0dWVwY2hnb3hhZ3BxdXdhbGJpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODA2MDczMjYsImV4cCI6MjA5NjE4MzMyNn0.g7742A-X_TM-YOZDB40e2aweKfxAfr4xbF29_NlsC2Q";

export const supabase = createClient(supabaseUrl, supabaseKey);

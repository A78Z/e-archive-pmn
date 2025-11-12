/** @type {import('next').NextConfig} */
const nextConfig = {
  typescript: {
    ignoreBuildErrors: true,
  },
  eslint: {
    ignoreDuringBuilds: true,
  },

  poweredByHeader: false,
  webpack: (config) => {
    config.resolve.alias = {
      ...(config.resolve.alias ?? {}),
      '@supabase/realtime-js': '@supabase/realtime-js/dist/module',
      '@supabase/supabase-js': '@supabase/supabase-js/dist/module',
    };
    return config;
  },
};

export default nextConfig;
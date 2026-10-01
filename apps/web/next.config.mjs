/** @type {import('next').NextConfig} */
const nextConfig = {
  // standalone output prepares Next.js for lean Docker builds without node_modules overhead
  output: "standalone",
  reactStrictMode: true,
};

export default nextConfig;

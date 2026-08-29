module.exports = {
  apps: [
    {
      name: 'havestory-dev',
      cwd: '/home/user/webapp/artifacts/havestory',
      script: 'pnpm',
      args: 'run dev',
      env: {
        PORT: 3000,
        VITE_API_PROXY_TARGET: 'https://havestory.vercel.app',
      },
      watch: false,
      instances: 1,
      exec_mode: 'fork',
    },
  ],
};

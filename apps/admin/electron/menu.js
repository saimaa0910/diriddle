const { Menu, shell } = require('electron');

function createApplicationMenu(mainWindow) {
  const isMac = process.platform === 'darwin';

  const template = [
    ...(isMac
      ? [
          {
            label: 'diriddle Admin',
            submenu: [
              { role: 'about' },
              { type: 'separator' },
              { role: 'services' },
              { type: 'separator' },
              { role: 'hide' },
              { role: 'hideOthers' },
              { role: 'unhide' },
              { type: 'separator' },
              { role: 'quit' },
            ],
          },
        ]
      : []),
    {
      label: 'File',
      submenu: [
        {
          label: 'Open Web Portal',
          click: () => shell.openExternal('http://localhost:3001'),
        },
        { type: 'separator' },
        isMac ? { role: 'close' } : { role: 'quit', label: 'Exit Admin Portal' },
      ],
    },
    {
      label: 'Moderation',
      submenu: [
        {
          label: 'Moderation Reports',
          accelerator: 'CmdOrCtrl+1',
          click: () => mainWindow.webContents.send('desktop:navigate', '/dashboard/reports'),
        },
        {
          label: 'Pseudonymous Users',
          accelerator: 'CmdOrCtrl+2',
          click: () => mainWindow.webContents.send('desktop:navigate', '/dashboard/users'),
        },
        {
          label: 'Communities',
          accelerator: 'CmdOrCtrl+3',
          click: () => mainWindow.webContents.send('desktop:navigate', '/dashboard/communities'),
        },
        {
          label: 'Post Feed',
          accelerator: 'CmdOrCtrl+4',
          click: () => mainWindow.webContents.send('desktop:navigate', '/dashboard/posts'),
        },
        {
          label: 'Comments',
          accelerator: 'CmdOrCtrl+5',
          click: () => mainWindow.webContents.send('desktop:navigate', '/dashboard/comments'),
        },
        {
          label: 'Appeals',
          accelerator: 'CmdOrCtrl+6',
          click: () => mainWindow.webContents.send('desktop:navigate', '/dashboard/appeals'),
        },
      ],
    },
    {
      label: 'Analytics & Compliance',
      submenu: [
        {
          label: 'Overview Dashboard',
          accelerator: 'CmdOrCtrl+0',
          click: () => mainWindow.webContents.send('desktop:navigate', '/dashboard'),
        },
        {
          label: 'Platform Metrics',
          accelerator: 'CmdOrCtrl+7',
          click: () => mainWindow.webContents.send('desktop:navigate', '/dashboard/analytics'),
        },
        {
          label: 'Staff Audit Logs',
          accelerator: 'CmdOrCtrl+8',
          click: () => mainWindow.webContents.send('desktop:navigate', '/dashboard/audit-logs'),
        },
      ],
    },
    {
      label: 'View',
      submenu: [
        { role: 'reload' },
        { role: 'forceReload' },
        { role: 'toggleDevTools' },
        { type: 'separator' },
        { role: 'resetZoom' },
        { role: 'zoomIn' },
        { role: 'zoomOut' },
        { type: 'separator' },
        { role: 'togglefullscreen' },
      ],
    },
    {
      label: 'Help',
      submenu: [
        {
          label: 'diriddle Documentation',
          click: () => shell.openExternal('https://github.com/saimaa0910/diriddle'),
        },
        {
          label: 'Grievance Officer (India IT Rules 2021)',
          click: () => shell.openExternal('mailto:grievance@diriddle.com'),
        },
        { type: 'separator' },
        {
          label: 'About diriddle Admin Desktop',
          click: () => {
            const { dialog } = require('electron');
            dialog.showMessageBox(mainWindow, {
              type: 'info',
              title: 'diriddle Admin Desktop',
              message: 'diriddle Admin Command Center v0.1.0',
              detail: 'Desktop management console for anonymous, location-based social network operations.\nBuilt with Electron, Next.js, and React.',
            });
          },
        },
      ],
    },
  ];

  const menu = Menu.buildFromTemplate(template);
  Menu.setApplicationMenu(menu);
}

module.exports = { createApplicationMenu };

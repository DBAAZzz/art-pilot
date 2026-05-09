const { execFileSync } = require('node:child_process')
const path = require('node:path')

exports.default = async function signMacosAdHoc(context) {
  if (context.electronPlatformName !== 'darwin') {
    return
  }

  if (context.appOutDir.includes('-universal-') && context.appOutDir.endsWith('-temp')) {
    return
  }

  const appPath = path.join(context.appOutDir, `${context.packager.appInfo.productFilename}.app`)

  execFileSync('codesign', [
    '--force',
    '--deep',
    '--sign',
    '-',
    appPath,
  ], {
    stdio: 'inherit',
  })
}

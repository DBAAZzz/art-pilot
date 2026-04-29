import { useState } from 'react'

function One() {
  console.log('window', window)
  return <>现在使用的chrome版本是{window.versions.chrome()}</>
}

function Two() {
  const [content, setContent] = useState('')

  const handleClick = async () => {
    const data = await window.api.readTxtFile()
    setContent(data)
  }
  return (
    <>
      <button onClick={handleClick}>读取文本文件</button>
      <div>文本内容为：{content}</div>
    </>
  )
}

function App() {
  return (
    <div
      style={{
        textAlign: 'center',
        marginTop: '10vh',
        fontFamily: 'sans-serif',
      }}
    >
      <h1>Art Pilot</h1>
      <p>Electron + React + TypeScript + Vite</p>
      <One />
      <Two />
    </div>
  )
}

export default App

import { Config } from '@remotion/cli/config'

Config.setVideoImageFormat('jpeg')
Config.setOverwriteOutput(true)
// three.js scenes (Kova Point) need WebGL in headless Chrome.
Config.setChromiumOpenGlRenderer('angle')

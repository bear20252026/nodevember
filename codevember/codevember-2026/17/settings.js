import GUI from 'three/addons/libs/lil-gui.module.min.js';

export function createSettings(reducedMotion,nativeRatio){
  return {flight:true,paused:reducedMotion,flightRate:1,current:1,density:.8,caustics:.65,rays:1,exposure:.65,
    translucency:1,adaptive:true,resolution:nativeRatio,meshlets:false,sound:true,
    temperature:.35,tint:0,saturation:1,contrast:1.15,vignette:2};
}

const HDR_PEAK_HELP='Highlight ceiling relative to SDR white. Your browser adapts this to the display.';

export function createSettingsPanel(settings,actions,performanceInfo,nativeRatio,displayOutput=null){
  const gui=new GUI({title:'Settings',width:245});
  gui.add(settings,'flight').name('Fly through').listen().onChange(actions.flight);
  gui.add(settings,'paused').name('Paused').listen();
  gui.add(settings,'sound').name('Sound').listen().onChange(actions.sound);
  gui.add(actions,'inspect').name('Inspect a frond');
  gui.add(actions,'reset').name('Restart the flight');
  const water=gui.addFolder('Water & light');
  water.add(settings,'current',0,2,.01).name('Current');
  water.add(settings,'density',.3,2,.01).name('Water density');
  water.add(settings,'caustics',0,1,.01).name('Caustics');
  water.add(settings,'rays',0,2,.01).name('Sun shafts');
  water.close();
  const grading=gui.addFolder('Color grading');
  grading.add(settings,'exposure',.3,2,.01).name('Exposure');
  grading.add(settings,'temperature',-1,1,.01).name('Temperature');
  grading.add(settings,'tint',-1,1,.01).name('Tint');
  grading.add(settings,'saturation',0,2,.01).name('Saturation');
  grading.add(settings,'contrast',.5,1.5,.01).name('Contrast');
  grading.add(settings,'vignette',0,2,.01).name('Vignette');
  grading.close();
  // HDR presentation follows the display (display-output.js), as on day 16.
  if(displayOutput){
    const display=gui.addFolder('Display');
    const output={
      get mode(){return displayOutput.mode;},set mode(value){displayOutput.setMode(value);},
      get peak(){return displayOutput.peak;},set peak(value){displayOutput.setPeak(value);},
      get status(){return displayOutput.active?'HDR':'SDR';}
    };
    display.add(output,'mode',{Automatic:'auto',SDR:'sdr'}).name('Display');
    const peak=display.add(output,'peak',1,8,.1).name('HDR peak');
    peak.domElement.title=HDR_PEAK_HELP;
    display.add(output,'status').name('Output').disable();
    displayOutput.onChange(()=>{
      for(const controller of display.controllers)controller.updateDisplay();
      peak.enable(displayOutput.active);
    });
    display.close();
  }
  const kelp=gui.addFolder('Kelp');
  kelp.add(settings,'translucency',0,1,.01).name('Leaf translucency');
  kelp.close();
  const rendering=gui.addFolder('Rendering');
  rendering.add(performanceInfo,'fps').name('Frames / second').listen().disable();
  rendering.add(performanceInfo,'blades').name('Blades + backdrop').disable();
  rendering.add(performanceInfo,'meshlets').name('Visible meshlets').listen().disable();
  rendering.add(settings,'adaptive').name('Auto resolution').listen().onChange(actions.adaptive);
  const resolution=rendering.add(settings,'resolution',Math.min(.6,nativeRatio),nativeRatio,.05).name('Pixel ratio').listen().onChange(actions.resolution);
  rendering.add(settings,'meshlets').name('Show meshlets').onChange(actions.meshlets);
  rendering.close();
  gui.close();gui.onChange(actions.changed);
  return {gui,
    // A new device pixel ratio changes the range of the ratio slider.
    setNativeRatio(ratio){resolution.min(Math.min(.6,ratio)).max(ratio).updateDisplay();}};
}

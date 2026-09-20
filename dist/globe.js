/* Geographic renderer: one north-up coordinate convention for Earth, borders and routes. */
(function () {
  'use strict';
  const geo = window.GlobeMath;
  const rad = Math.PI / 180;
  const escape = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const valid = p => p && Number.isFinite(p.latitude) && Math.abs(p.latitude) <= 90 && Number.isFinite(p.longitude) && Math.abs(p.longitude) <= 180;
  const countryLabels = [
    ['INDIA',23,80],['CHINA',36,103],['RUSSIA',61,100],['AUSTRALIA',-25,134],
    ['SAUDI ARABIA',23,44],['SOUTH AFRICA',-29,25],['EGYPT',27,30],['BRAZIL',-12,-52],
    ['CANADA',59,-108],['UNITED STATES',39,-101],['ARGENTINA',-37,-65],['JAPAN',38,138],
    ['INDONESIA',-5,118],['KAZAKHSTAN',48,67],['FRANCE',47,2],['GREENLAND',72,-40]
  ];

  // Quantized TopoJSON arcs come from world-atlas / Natural Earth, not hand-drawn outlines.
  let bordersPromise;
  function loadBorders() {
    return bordersPromise ||= fetch('assets/countries-110m.json').then(r => {
      if (!r.ok) throw new Error('Country boundaries unavailable');
      return r.json();
    }).then(topology => topology.arcs.map(arc => {
      let x = 0, y = 0;
      return arc.map(delta => {
        x += delta[0]; y += delta[1];
        return geo.vector(y * topology.transform.scale[1] + topology.transform.translate[1],
          x * topology.transform.scale[0] + topology.transform.translate[0]);
      });
    }));
  }

  class EarthGlobe {
    constructor(stage) {
      this.stage = stage;
      this.camera = {longitude:65, latitude:22};
      this.zoom = 1;
      this.regions = [];
      this.routes = [];
      this.borders = [];
      this.showCountries = true;
      this.showRoutes = true;
      this.abort = new AbortController();
      stage.innerHTML = `<div class="earth-toolbar"><span class="earth-heading">Global distribution</span><div class="earth-layers"><button type="button" data-earth="countries" aria-pressed="true">Countries</button><button type="button" data-earth="routes" aria-pressed="true">Routes</button></div></div>
        <div class="earth-viewport"><canvas class="earth-model" id="earthCanvas" tabindex="0" aria-label="Interactive Earth. Drag or use arrow keys to rotate. Plus and minus zoom. Home resets the view."></canvas><svg class="earth-labels" id="globeOverlay" aria-label="Sales destinations"></svg><p class="earth-message" role="status">Loading Earth…</p></div>
        <div class="earth-footer"><div class="earth-selection" aria-live="polite"></div><div class="earth-navigation"><button type="button" data-earth="out" aria-label="Zoom out">−</button><button type="button" data-earth="reset">Reset view</button><button type="button" data-earth="in" aria-label="Zoom in">+</button></div></div>
        <div class="earth-caption"><span>Drag to rotate · + / − to zoom</span><span>Illustrative routes · demo sales data</span></div>
        <div class="earth-legend" aria-label="Route status legend"><span class="in-transit">In transit</span><span class="pending">Pending</span><span class="delivered">Delivered</span><span class="delayed">Delayed</span></div>
        <div class="earth-credit">Earth: <a href="https://science.nasa.gov/earth/earth-observatory/" target="_blank" rel="noopener">NASA Earth Observatory</a> · Boundaries: <a href="https://www.naturalearthdata.com/" target="_blank" rel="noopener">Natural Earth</a></div>`;
      this.viewport = stage.querySelector('.earth-viewport');
      this.canvas = stage.querySelector('canvas');
      this.overlay = stage.querySelector('svg');
      this.message = stage.querySelector('.earth-message');
      this.selection = stage.querySelector('.earth-selection');
      try { this.initGL(); } catch (error) {
        this.message.textContent = '3D Earth is unavailable. Enable WebGL to use the interactive view; sales regions remain available below.';
        this.failed = true;
        console.warn(error.message);
      }
      this.bind();
      this.observer = new ResizeObserver(() => this.requestDraw());
      this.observer.observe(this.viewport);
      loadBorders().then(arcs => {this.borders = arcs;this.requestDraw();}).catch(() => {
        this.stage.querySelector('[data-earth="countries"]').disabled = true;
        this.stage.querySelector('.earth-credit').append(' · Borders unavailable');
      });
    }

    initGL() {
      const gl = this.canvas.getContext('webgl', {alpha:true,antialias:true});
      if (!gl) throw new Error('WebGL is unavailable');
      this.gl = gl;
      const shader = (type, source) => {
        const handle = gl.createShader(type);
        gl.shaderSource(handle, source); gl.compileShader(handle);
        if (!gl.getShaderParameter(handle, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(handle));
        return handle;
      };
      const vertex = shader(gl.VERTEX_SHADER, `
        attribute vec3 aPosition; attribute vec2 aUv;
        uniform vec2 uCamera; uniform vec2 uSize; uniform vec2 uCenter; uniform float uRadius;
        varying vec2 vUv; varying vec3 vNormal;
        void main() {
          float c=cos(uCamera.x),s=sin(uCamera.x),b=cos(uCamera.y),t=sin(uCamera.y);
          float x=c*aPosition.x-s*aPosition.z;
          float z=s*aPosition.x+c*aPosition.z;
          vec3 p=vec3(x,b*aPosition.y-t*z,t*aPosition.y+b*z);
          vUv=aUv; vNormal=p;
          vec2 pixel=uCenter+vec2(p.x,-p.y)*uRadius;
          gl_Position=vec4(pixel.x/uSize.x*2.0-1.0,1.0-pixel.y/uSize.y*2.0,-p.z*0.5,1.0);
        }`);
      const fragment = shader(gl.FRAGMENT_SHADER, `
        precision mediump float; uniform sampler2D uTexture;
        varying vec2 vUv; varying vec3 vNormal;
        void main() {
          vec3 normal=normalize(vNormal);
          float light=max(dot(normal,normalize(vec3(-0.35,0.45,1.0))),0.0);
          float rim=pow(1.0-max(normal.z,0.0),3.0);
          vec3 land=texture2D(uTexture,vUv).rgb;
          gl_FragColor=vec4(land*(0.42+0.68*light)+vec3(0.025,0.085,0.13)*rim,1.0);
        }`);
      const program = gl.createProgram();
      gl.attachShader(program,vertex);gl.attachShader(program,fragment);gl.linkProgram(program);
      if (!gl.getProgramParameter(program,gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(program));
      gl.deleteShader(vertex);gl.deleteShader(fragment);
      this.program = program;
      gl.useProgram(program);
      const vertices=[],uvs=[],indices=[],nx=128,ny=64;
      for(let y=0;y<=ny;y++)for(let x=0;x<=nx;x++) {
        const lat=-90+180*y/ny,lon=-180+360*x/nx;
        vertices.push(...geo.vector(lat,lon));uvs.push(...geo.uv(lat,lon));
      }
      for(let y=0;y<ny;y++)for(let x=0;x<nx;x++) {
        const a=y*(nx+1)+x,b=a+1,c=a+nx+1,d=c+1;
        indices.push(a,b,c,b,d,c);
      }
      this.buffers=[];
      const buffer=(target,data) => {
        const handle=gl.createBuffer();this.buffers.push(handle);
        gl.bindBuffer(target,handle);gl.bufferData(target,data,gl.STATIC_DRAW);return handle;
      };
      const attribute=(name,data,size) => {
        buffer(gl.ARRAY_BUFFER,new Float32Array(data));
        const location=gl.getAttribLocation(program,name);
        gl.enableVertexAttribArray(location);gl.vertexAttribPointer(location,size,gl.FLOAT,false,0,0);
      };
      attribute('aPosition',vertices,3);attribute('aUv',uvs,2);
      buffer(gl.ELEMENT_ARRAY_BUFFER,new Uint16Array(indices));this.indexCount=indices.length;
      this.uniforms=Object.fromEntries(['uCamera','uSize','uCenter','uRadius'].map(name=>[name,gl.getUniformLocation(program,name)]));
      this.texture=gl.createTexture();gl.bindTexture(gl.TEXTURE_2D,this.texture);
      gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,1,1,0,gl.RGBA,gl.UNSIGNED_BYTE,new Uint8Array([18,43,66,255]));
      gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.LINEAR);
      const image=new Image();this.image=image;
      image.onload=()=>{
        if(this.disposed)return;
        gl.bindTexture(gl.TEXTURE_2D,this.texture);
        gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL,true);
        let textureSource=image;
        const maxSize=gl.getParameter(gl.MAX_TEXTURE_SIZE);
        if(image.width>maxSize||image.height>maxSize){
          const ratio=Math.min(maxSize/image.width,maxSize/image.height);
          textureSource=document.createElement('canvas');
          textureSource.width=Math.floor(image.width*ratio);textureSource.height=Math.floor(image.height*ratio);
          textureSource.getContext('2d').drawImage(image,0,0,textureSource.width,textureSource.height);
        }
        gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,gl.RGBA,gl.UNSIGNED_BYTE,textureSource);
        if((textureSource.width&(textureSource.width-1))===0 && (textureSource.height&(textureSource.height-1))===0) {
          gl.generateMipmap(gl.TEXTURE_2D);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR_MIPMAP_LINEAR);
        }
        this.message.hidden=true;this.textureReady=true;this.requestDraw();
      };
      image.onerror=()=>{this.message.textContent='Earth imagery could not load. Reload the page to try again.';};
      image.src='assets/earth-daymap.jpg';
    }

    bind() {
      const on=(element,type,listener,options={})=>element.addEventListener(type,listener,{...options,signal:this.abort.signal});
      let drag;
      on(this.canvas,'pointerdown',e=>{
        if(e.button!==0)return;
        drag={x:e.clientX,y:e.clientY};this.canvas.setPointerCapture(e.pointerId);this.canvas.classList.add('dragging');
      });
      on(this.canvas,'pointermove',e=>{
        if(!drag)return;
        this.camera.longitude-= (e.clientX-drag.x)*.3;
        this.camera.latitude=Math.max(-85,Math.min(85,this.camera.latitude+(e.clientY-drag.y)*.3));
        drag={x:e.clientX,y:e.clientY};this.requestDraw();
      });
      const end=()=>{drag=null;this.canvas.classList.remove('dragging');};
      on(this.canvas,'pointerup',end);on(this.canvas,'pointercancel',end);on(this.canvas,'lostpointercapture',end);
      on(this.canvas,'wheel',e=>{
        // Normal page scrolling stays available; Ctrl/Command + wheel zooms the globe.
        if(!e.ctrlKey&&!e.metaKey)return;
        e.preventDefault();this.changeZoom(e.deltaY<0?.08:-.08);
      },{passive:false});
      on(this.canvas,'keydown',e=>{
        const moves={ArrowLeft:[-8,0],ArrowRight:[8,0],ArrowUp:[0,8],ArrowDown:[0,-8]};
        if(moves[e.key]){e.preventDefault();this.camera.longitude+=moves[e.key][0];this.camera.latitude=Math.max(-85,Math.min(85,this.camera.latitude+moves[e.key][1]));this.requestDraw();}
        else if(['+','=','-','Home'].includes(e.key)){e.preventDefault();e.key==='Home'?this.reset():this.changeZoom(e.key==='-'?-.1:.1);}
      });
      on(this.stage,'click',e=>{
        const button=e.target.closest('[data-earth]');if(!button)return;
        const action=button.dataset.earth;
        if(action==='reset')this.reset();
        if(action==='in'||action==='out')this.changeZoom(action==='in'?.1:-.1);
        if(action==='countries'||action==='routes') {
          const key=action==='countries'?'showCountries':'showRoutes';this[key]=!this[key];
          button.setAttribute('aria-pressed',String(this[key]));this.requestDraw();
        }
      });
      on(this.canvas,'webglcontextlost',e=>{e.preventDefault();this.failed=true;this.message.hidden=false;this.message.textContent='3D rendering was interrupted. Reload to restore Earth.';});
    }

    changeZoom(delta){this.zoom=Math.max(.75,Math.min(1.6,this.zoom+delta));this.requestDraw();}
    reset(){this.camera={longitude:65,latitude:22};this.zoom=1;this.requestDraw();}
    focus(place){if(valid(place)){this.camera={longitude:place.longitude,latitude:place.latitude};this.requestDraw();}}
    update(regions,shipments,selectedId) {
      this.regions=regions.filter(valid);
      this.selected=this.regions.find(r=>r.id===selectedId)||this.regions[0];
      this.routes=shipments.filter(s=>valid(s.origin)&&valid(s.destination)).map(s=>({
        ...s,points:geo.greatCircle(s.origin,s.destination,96,.055)
      }));
      const r=this.selected;
      this.selection.innerHTML=r?`<strong>${escape(r.city)} <span>· ${escape(r.country)}</span></strong><small>${new Intl.NumberFormat('en-IN',{style:'currency',currency:'INR',maximumFractionDigits:0}).format(r.sales)} sales · ${r.units} units</small>`:'<strong>No sales destinations</strong>';
      this.requestDraw();
    }
    requestDraw(){if(!this.disposed&&!this.frame)this.frame=requestAnimationFrame(()=>{this.frame=0;this.draw();});}
    draw() {
      if(this.disposed||!this.viewport.clientWidth||!this.viewport.clientHeight)return;
      const width=this.viewport.clientWidth,height=this.viewport.clientHeight,dpr=Math.min(devicePixelRatio||1,2);
      this.layout={cx:width/2,cy:height/2,radius:Math.min(width*.43,height*.43)*this.zoom};
      if(this.canvas.width!==Math.round(width*dpr)||this.canvas.height!==Math.round(height*dpr)){
        this.canvas.width=Math.round(width*dpr);this.canvas.height=Math.round(height*dpr);
      }
      if(this.gl&&!this.failed) {
        const gl=this.gl,u=this.uniforms;
        gl.viewport(0,0,this.canvas.width,this.canvas.height);gl.clearColor(0,0,0,0);
        gl.clear(gl.COLOR_BUFFER_BIT|gl.DEPTH_BUFFER_BIT);gl.enable(gl.DEPTH_TEST);gl.depthFunc(gl.LESS);
        gl.useProgram(this.program);gl.bindTexture(gl.TEXTURE_2D,this.texture);
        gl.uniform2f(u.uCamera,this.camera.longitude*rad,this.camera.latitude*rad);
        gl.uniform2f(u.uSize,width,height);gl.uniform2f(u.uCenter,this.layout.cx,this.layout.cy);
        gl.uniform1f(u.uRadius,this.layout.radius);gl.drawElements(gl.TRIANGLES,this.indexCount,gl.UNSIGNED_SHORT,0);
      }
      this.drawOverlay(width,height);
    }

    drawOverlay(width,height) {
      const project=p=>geo.project(p,this.camera,this.layout);
      const pathFor=points=>{
        let path='',drawing=false;
        for(const vector of points){const p=project(vector);if(!p.visible){drawing=false;continue;}
          path+=`${drawing?'L':'M'}${p.x.toFixed(2)},${p.y.toFixed(2)}`;drawing=true;
        }return path;
      };
      const {cx,cy,radius}=this.layout;
      const borders=this.showCountries?`<path class="earth-borders" d="${this.borders.map(pathFor).join('')}"/>`:'';
      const routes=this.showRoutes?this.routes.map(s=>{
        const tone=['pending','in-transit','delivered','delayed'].includes(s.status)?s.status:'pending';
        return `<path class="earth-route ${tone}" d="${pathFor(s.points)}"><title>${escape(s.origin.label)} → ${escape(s.destination.label)} · ${escape(s.tracking)}</title></path>`;
      }).join(''):'';
      const placed=[];
      const label=(text,p)=>{
        const size=text.length*6.2,x=p.x-size/2,y=p.y;
        const box={x:x-5,y:y-12,w:size+10,h:20};
        if(x<8||x+size>width-8||y<20||y>height-12||placed.some(b=>box.x<b.x+b.w&&box.x+box.w>b.x&&box.y<b.y+b.h&&box.y+box.h>b.y))return '';
        placed.push(box);return `<text class="earth-country" x="${p.x.toFixed(1)}" y="${p.y.toFixed(1)}" text-anchor="middle">${escape(text)}</text>`;
      };
      const nodes=this.regions.map(r=>{
        const p=project(geo.vector(r.latitude,r.longitude));if(p.z<.04)return '';
        const active=r.id===this.selected?.id;
        placed.push({x:p.x-16,y:p.y-16,w:32,h:32});
        return `<g class="earth-node ${active?'selected':''}" data-region-id="${escape(r.id)}" tabindex="0" role="button" aria-label="Select ${escape(r.city)}, ${escape(r.country)}"><title>${escape(r.city)}, ${escape(r.country)}</title><circle class="earth-hit" cx="${p.x}" cy="${p.y}" r="11"/>${active?`<circle class="earth-ring" cx="${p.x}" cy="${p.y}" r="9"/>`:''}<circle class="earth-pin" cx="${p.x}" cy="${p.y}" r="4"/></g>`;
      }).join('');
      const labels=this.showCountries?countryLabels.map(([name,lat,lon])=>{
        const p=project(geo.vector(lat,lon));return p.z>.25?label(name,p):'';
      }).join(''):'';
      this.overlay.setAttribute('viewBox',`0 0 ${width} ${height}`);
      this.overlay.innerHTML=`<circle class="earth-limb" cx="${cx}" cy="${cy}" r="${radius}"/>${borders}${routes}${labels}${nodes}`;
      this.stage.querySelector('[data-earth="out"]').disabled=this.zoom<=.75;
      this.stage.querySelector('[data-earth="in"]').disabled=this.zoom>=1.6;
    }

    destroy(){
      this.disposed=true;cancelAnimationFrame(this.frame);this.abort.abort();this.observer.disconnect();
      if(this.image){this.image.onload=null;this.image.onerror=null;}
      if(this.gl){for(const buffer of this.buffers||[])this.gl.deleteBuffer(buffer);this.gl.deleteTexture(this.texture);this.gl.deleteProgram(this.program);}
    }
  }
  window.EarthGlobe=EarthGlobe;
})();

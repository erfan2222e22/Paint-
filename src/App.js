
import React, { useLayoutEffect, useEffect, useState,useRef}from 'react';
import rough from 'roughjs';
import { getStroke } from 'perfect-freehand'

const genrator = rough.generator();

const createElement = (id, x1, y1, x2, y2, type)=> {
  
  switch (type) {
        
    case 'line':
      case 'rectangle': 
      const roughelment = type === 'line' ?
        genrator.line(x1, y1, x2, y2)
        : genrator.rectangle(x1, y1, x2 - x1, y2 - y1);
      return { id, x1, y1, x2, y2, type, roughelment };
    case 'pencil':
      return { id, type, points: [{ x: x1, y: y1 }] };
    case 'text':
      return { id, type, x1, y1, x2, y2, text: '' };
    default:
        throw new Error(`type not recognised ${type}`)
  }
}

const cursorforpositon = (position) => {
  
  switch (position) {

    case "tl":    
    case "br":  
    case "start":
    case "end":
    case "nwse-resize":
    case "tr":
    case "bl":
    case "nwse-resize":
    default:        
      return 'move'
  }
}  
const resizedcordinates = (clientX, clientY, position, couredinast) => {
  
  const { x1, y1, x2, y2 } = couredinast;
  switch (position) {
  
    case 'tl':
      case 'start':
      return { x1: clientX, y1: clientY, x2, y2 };
     
    case 'tr':
      return { x1, y1: clientY, x2: clientX, y2 };
  
    case 'bl':
      return { x1: clientX, y1, x2, y2: clientY };
   
    case 'br':
      case'end':
      return { x1, y1, x2: clientX, y2: clientY };

    default:
      return null;
  }
}

const nearpint = (x, y, x1, y1, name) => {
  return Math.abs(x - x1) < 5 && Math.abs(y - y1) < 5 ? name : null;
}

const online = (x1, y1, x2, y2, x, y, mxadistance = 1) => {

  const a = { x: x1, y: y1 };
  const b = { x: x2, y: y2 };
  const c = { x, y };
  const offset = distance(a, b) - (distance(a, c) + distance(b, c));
  return Math.abs(offset) < mxadistance ? "inside" : null;
}
const positionwithinelment = (x, y, elment) => {
  const { type, x1, x2, y1, y2 } = elment;
  switch (type) {
    case 'line':
      const on = online(x1, y1, x2, y2, x, y);
      const start = nearpint(x, y, x1, y1, 'start');
      const end = nearpint(x, y, x2, y2, 'end');
      return start || end || on;
    case 'rectangle':  
      const topleft = nearpint(x, y, x1, y1, 'tl');
      const topright = nearpint(x, y, x2, y1, 'tr');
      const bootomleft = nearpint(x, y, x1, y2, 'bl');
      const bootright = nearpint(x, y, x2, y2, 'br');
      const inseide = x >= x1 && x <= x2 && y >= y1 && y <= y2 ? "inside" : null;
      return topleft || topright || bootomleft || bootright || inseide;
    
    case 'pencil':
      const betweenanypoint = elment.points.some((point, index) => {
        const nextpoint = elment.points[index + 1];
        if (!nextpoint) return false;
        return online(point.x, point.y, nextpoint.x, nextpoint.y, x, y, 5) != null;
    })
      return betweenanypoint ? "inside" : null;
    case 'text':
      return x >= x1 && x <= x2 && y >= y1 && y <= y2 ? "inside" : null;
    
    default:
      throw new Error(`type not recongised: ${type}`)
  }
}
const distance = (a, b) => Math.sqrt(Math.pow(a.x - b.x, 2) + Math.pow(a.y - b.y, 2))

const getelmentatposition = (x, y, elments) => {
return elments.map(elments => ({ ...elments, position: positionwithinelment(x, y, elments) }))
  .find(elment => elment.position !== null)
}   

const adjustelmentcoredisance = (elment) => {
  
  const { type, x1, y1, x2, y2 } = elment;

  if (type === 'rectangle') {
  const minX = Math.min(x1, x2);
  const maxX = Math.max(x1, x2);
  const minY = Math.min(y1, y2);
  const maxY = Math.max(y1, y2);
    return { x1: minX, y1: minY, x2: maxX, y2: maxY };
  } else {
    
    if (x1 < x2 || (x1 === x2 && y1 < y2)) {
      return { x1, y1, x2, y2 };
  
    } else {
      return { x1: x2, y1: y2, x2: x1, y2: y1 };
    }
  }
}

function getSvgPathFromStroke(stroke) {
  if (!stroke.length) return ''
  
  const d = stroke.reduce(
    (acc, [x0, y0], i, arr) => {
      const [x1, y1] = arr[(i + 1) % arr.length]
      acc.push(x0, y0, (x0 + x1) / 2, (y0 + y1) / 2)
      return acc
    },
    ['M', ...stroke[0], 'Q']
  )

  d.push('Z')
  return d.join(' ')
}
const useHistory = initialstate => {
  const [index, setindex] = useState(0);
  const [history, sethistory] = useState([initialstate]);

  const setstate = (action, owerrite = false) => {
    
    const newstate = typeof action === 'function' ? action(history[index]) : action;
    if (owerrite) {
      const historycopy = [...history];
      historycopy[index] = newstate;
      sethistory(historycopy);
    } else {   
      
      const updatestate = [...history].slice(0, index + 1);
      sethistory(prevestate => [...updatestate, newstate]);
      setindex(prevestate => prevestate + 1);
    }    
  }

  const Undo = () => { index > 0 && setindex(prevestate => prevestate - 1) };
  const redo = () => { index < history.length - 1 && setindex(prevestate => prevestate + 1) };
  return [history[index], setstate, Undo, redo];
}
const drawelments = (roughcanvas, ctx, elment) => {

  switch (elment.type) { 
    case 'line':
    case 'rectangle':
      roughcanvas.draw(elment.roughelment)
      break;    
    case 'pencil':

      const Stroke = getSvgPathFromStroke(getStroke(elment.points));
      ctx.fill(new Path2D(Stroke));
      break;
    
    case 'text':
      
      // ctx.fillStyle='red'
      ctx.textBaseline = 'top';
      ctx.font = '24px sans-serif';
      ctx.fillText(elment.text, elment.x1, elment.y1);
      break;
      
      default:
      throw new Error(`type not recognised ${elment.type}`)
  }
}
const addjustreqired = type => ['line', 'rectangle'].includes(type);
function App() {    
  const [elments, setelments, Undo, redo] = useHistory([]);
  const [action, setaction] = useState('none');
  const [tool, settool] = useState('text');
  const [selectedelment, setselectedelment] = useState(null);
  const [sacale, setscale] = React.useState(1);
  const texTarearef = useRef()

useLayoutEffect(() => {
    const canvas = document.querySelector('canvas');
    const roughcanvas = rough.canvas(canvas);
    const ctx = canvas.getContext('2d');
    
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    elments.forEach(elment => {

      if (action === 'writing ' && selectedelment.id === elment.id) return;
      drawelments(roughcanvas, ctx, elment);

    });
  ctx.restore();
  }, [elments, action, selectedelment])
   
  useEffect(() => {
    
    const undoredofunction = event => {
      
      if ((event.metaKey || event.ctrlKey) && event.key === 'z') {
        
        if (event.shiftKey) {
          redo();
        } else {
          Undo();
        }
      }    
    }
    document.addEventListener('keydown', undoredofunction)
    return () => {
      document.removeEventListener('keydown', undoredofunction)
    }
  }, [Undo, redo])

  
  useEffect(() => {
    
    const textarea = texTarearef.current;
    if (action === 'writing') {
      
      setTimeout(() => {

        textarea.focus();
        textarea.value = selectedelment.text;

      }, 0);
    }

  }, [action, selectedelment])

  const updateelment = (id, x1, y1, x2, y2, type, options) => {
    
    const elmentcopy = [...elments];
    switch (type) {

      case 'line':
      case 'rectangle':
        elmentcopy[id] = createElement(id, x1, y1, x2, y2, type);
        break;
      
      case 'pencil':
        elmentcopy[id].points = [...elmentcopy[id].points, { x: x2, y: y2 }];
        break;
      
      case 'text':
        const textwith = document.querySelector('canvas')
          .getContext('2d')
          .measureText(options.text).width;
        const textheight =24;
        elmentcopy[id] = {
          
          ...createElement(id, x1, y1, x1 + textwith, y1 + textheight, type),
          text: options.text,

        }

        break;
      
        default:
          throw new Error(`type not recognised : ${type}`)    
    }
      setelments(elmentcopy, true);
  }


  const handelmousdown = event => {
    if (action === 'writing') return; 
    const { clientX, clientY } = event

    if (tool === 'selection') {
      const elment = getelmentatposition( clientX, clientY, elments);
      if (elment) {
        if (elment.type === 'pencil') {

          const xOffsets = elment.points.map(point => clientX - point.x);
          const yOffsets = elment.points.map(point => clientY - point.y);
          setselectedelment({ ...elment, xOffsets, yOffsets });

        } else {
          const offsetX = clientX - elment.x1;
          const offsetY = clientY - elment.y1;
          setselectedelment({ ...elment, offsetX, offsetY });
          
        }
        setselectedelment(prevestate => prevestate);
        if (elment.position === 'inside') {
          setaction('moving');
        }
        else {
          setaction('moving');
        }
      }
    }
    
    else {
      const id = elments.length;
      const elment = createElement(id, clientX, clientY, clientX, clientY, tool);
      setelments(prevestate => [...prevestate, elment]);
      setselectedelment(elment);
      setaction(tool === 'text' ? 'writing' :'drawing');
    }
  }
  const handelmousemove = event => {
    const { clientX, clientY } =event

    if (tool === 'selection') {
      const elment = getelmentatposition(clientX, clientY, elments);
      event.target.style.cursor = elment ? cursorforpositon(elment.position) : 'defult';
    }

    if (action === 'drawing') {

      const index = elments.length - 1;
      const { x1, y1 } = elments[index];
      updateelment(index, x1, y1, clientX, clientY,tool)
      
    } else if (action === 'moving') {
  
      if (selectedelment.type === 'pencil') {
        const {id} = selectedelment;
        const newPoints = selectedelment.points.map((_, index) => ({
          x: clientX - selectedelment.xOffsets[index],
          y: clientY - selectedelment.yOffsets[index],
        }));
       
        const elmentscopy = [...elments];
        elmentscopy[selectedelment.id].points = newPoints;
        setelments(elmentscopy, true);
      }
      else {
      const { id,x1, x2, y1, y2, type, offsetX, offsetY } = selectedelment;
      const width = x2 - x1;
      const height = y2 - y1;
      const neX1 = clientX - offsetX;
      const neY2 = clientY - offsetY;
      const option = type === 'text' ? { text: selectedelment.text } : {};
        updateelment(id, neX1, neY2, neX1 + width, neY2 + height, type, option);
      }
    } else if (action === 'resizing') {
      const { id, type, position, ...couredinast } = selectedelment;
      const { x1, y1, x2, y2 } = resizedcordinates(clientX, clientY, position, couredinast);
      updateelment(id, x1, y1, x2, y2, type);
    }

  }
  const handelmouseup = event => {
    const { clientX, clientY } =event
    
    if (selectedelment) {  

      if (

        selectedelment.type === 'text' &&
        clientX - selectedelment.offsetX
        === selectedelment.x1 && clientX -
        selectedelment.offsetY
        === selectedelment.y1
      
      ) {
        
        setaction('writing');
        return;
      }
      const index = selectedelment.id;
       const { id, type } = elments[index];    

      if ((action === 'drawing' || action === 'resizing') && addjustreqired(type)) {
           
        const { x1, y1, x2, y2 } = adjustelmentcoredisance(elments[index]);
        updateelment(id, x1, y1, x2, y2, type);
      }
    
    }
    if (action === 'writing') return;
    setaction('none');
    setselectedelment(null);
        
  }

  const handelblur = event => {
   
  const { id, x1, y1, type } = selectedelment;
  setaction("none");
  setselectedelment(null);
  updateelment(id, x1, y1, null, null, type, { text: event.target.value });
  }

  const onZome = (delta) => {
  
    setscale(prevestate => prevestate + delta);
  }
    return (
  
    <div>
      <div style={{ position:'fixed',zIndex:2 }}>
        
        <input
        
          type='radio'
          id='linew'
          checked={tool === 'selection'}
          onChange={() => settool('selection')}
        />
        <label htmlFor='selection'>Selection</label>
        <input
          
          type='radio'
          id='linew'
          checked={tool === 'line'}
          onChange={() => settool('line')}
        />
        <label htmlFor='line'>Line</label>
        <input
          type='radio'
          id='linew'
          checked={tool === 'rectangle'}
          onChange={() => settool('rectangle')}
        />
        <label htmlFor='rectangle'>Rectangle</label>

        <input
          
          type='radio'
          id='pencil'
          checked={tool === 'pencil'}
          onChange={() => settool('pencil')}
        />
        <label htmlFor='pencil'>Pencil</label>

        <input
          
          type='radio'
          id='text'
          checked={tool === 'text'}
          onChange={() => settool('text')}
        />
        <label htmlFor='text'>Text</label>  
        
  
      </div>

        <div style={{ position: 'fixed', bottom: 0, padding: 5, zIndex: 2 }}>

        <button style={{width:'50px'}} onClick={Undo}>Undo</button>
        <button style={{width:'50px'}} onClick={redo}>Redo</button>
      </div>
  
      {action === 'writing' ?
        <textarea
          onBlur={handelblur}
          ref={texTarearef}
          style={{

            position: 'fixed',
            top: selectedelment.y1 , 
            left: selectedelment.x1 ,
            margin:0,
            padding:0,
            border: 0,
            outline: 0,
            resize: 'auto',
            background: 'transparent',
            whiteSpace: 'pre',  
            overflow: 'hidden',
          }}
          
        />
        : null}
      
      <canvas
        id='canvas'
        width={window.innerWidth}
        height={window.innerHeight}
        onMouseDown={handelmousdown}
        onMouseMove={handelmousemove}
        onMouseUp={handelmouseup}
      >
      </canvas>
    </div>
  )
}


export default App;

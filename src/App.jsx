import {Routes,Route} from 'react-router-dom';
import Login from './components/Login.jsx';
import Register from './components/Register.jsx';
import {AuthProvider} from './context/authContext.jsx';
import { ProtectedRoute } from './components/ProtectedRoute.jsx';
import {Home}  from './components/Home.jsx';
//import {Diagrama} from './components/diagramaDeSecuencia/Diagrama.jsx';
import  Principal  from './components/principal.jsx';
//import Diagram from './components/diagramaDeSecuencia/Diagram.jsx';
import ClassDiagram from './components/diagrama/ClassDiagram.jsx';

export default function App() {
  return (
    <div className='bg-slate-300 h-screen text-black flex'>
      <AuthProvider>
        <Routes>
          <Route path="/" element ={<Principal/>}/>
          <Route path="/home" element ={  <ProtectedRoute>  <Home/>   </ProtectedRoute>  } />
          {/*<Route path="/diagrama/:diagramaId" element ={  <ProtectedRoute>  <Diagrama/>   </ProtectedRoute>  } />*/}
          {/*<Route path="/diagram/:diagramaId"/:documentId element ={  <ProtectedRoute>  <Diagram/>   </ProtectedRoute>  } />  si  */} 
          <Route path="/diagram/:diagramaId" element ={  <ProtectedRoute>  <ClassDiagram/>   </ProtectedRoute>  } />
          <Route path="/login" element ={<Login/>} />
          <Route path="/register" element ={<Register/>} />
        </Routes>
      </AuthProvider>
    </div>
  )
}
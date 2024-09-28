import React, { useState, useEffect } from 'react';
import {useAuth } from '../context/authContext';
import { useNavigate } from 'react-router-dom';
import { db } from '../firebase.jsx'; // Importa la instancia de Firestore 
import { collection, addDoc, getDocs,getDoc, deleteDoc, doc, updateDoc, onSnapshot, query, where } from 'firebase/firestore';

import '../components/Login.jsx';
//shadcn
import { Button } from "@/components/ui/button"

const DiagramaCard = ({ diagrama ,onDelete,handleUpdated }) => {
    const navigate = useNavigate();
    //const fechaCreacion = diagrama.createdAt.toDate().toLocaleDateString('es-ES');
    const fechaCreacion = diagrama.createdAt ? diagrama.createdAt.toDate().toLocaleDateString('es-ES') : 'Fecha no disponible';

    const [isEditing, setIsEditing] = useState(false);
    const [editName, setEditName] = useState(diagrama.nombre);
    const [editCodigo, setEditCodigo] = useState(diagrama.codigo);

    const handleView = () => {
        console.log(`ID del diagrama: ${diagrama.diagramaId}`);
        navigate(`/diagram/${diagrama.diagramaId}?nombre=${diagrama.nombre}`);
    };
    
    const handleDelete = async () => {
        if (window.confirm(`¿Estás seguro de que quieres eliminar el diagrama '${diagrama.nombre}'?`)) {
            try {
                await deleteDoc(doc(db, 'diagramas', diagrama.id));
                onDelete(diagrama.id); 
            } catch (error) {
                console.error('Error al eliminar el diagrama:', error);
            }
        }
    };

    const handleEdit = () => {
        setIsEditing(true);
    };

    const handleSave = async () => {
        try {
            await updateDoc(doc(db, 'diagramas', diagrama.id), {
                nombre: editName,
                codigo: editCodigo
            });
            setIsEditing(false);
            handleUpdated();
        } catch (error) {
            console.error('Error al editar el diagrama:', error);
        }
    };

    return (
    <div style={{ cursor: 'pointer', border: '1px solid black', margin: '10px', padding: '10px', width: '250px' }}>
        {isEditing ? (
            <>
                <input type="text" value={editName} onChange={(e) => setEditName(e.target.value)} />
                <input type="text" value={editCodigo} onChange={(e) => setEditCodigo(e.target.value)} />
                <Button onClick={handleSave}>Guardar</Button>
            </>
        ) : (
            <>
        <div>
            <h1><strong>{diagrama.nombre}</strong></h1>
            <p>Fecha de creación: {fechaCreacion}</p>
        </div>
        <Button onClick={handleView} style={{ marginTop: '10px',marginRight: '8px' }}>Ver</Button>
        <Button onClick={handleDelete} style={{ marginTop: '10px',marginRight: '8px' }}>Eliminar</Button>
        <Button onClick={handleEdit} style={{ marginTop: '10px' }}>Editar</Button>

        </>
         )}
    </div>
    );
};


/*******************************************************************************************************/

export function Home() {
    const { logout, user, loading } = useAuth();
    const navigate = useNavigate();

    const [nombre, setNombre] = useState('');
    const [codigo, setCodigo] = useState('');

    const [nombreAcceso, setNombreAcceso] = useState('');
    const [codigoAcceso, setCodigoAcceso] = useState('');
    const [idAcceso, setIdAcceso] = useState(''); // [1]

    const [diagramas, setDiagramas] = useState([]);
    const [lastUpdated, setLastUpdated] = useState(Date.now());

    const [activeForm, setActiveForm] = useState(null);

    //
    const [nodeDataArray, setNodeDataArray] = useState([]);
    const [linkDataArray, setLinkDataArray] = useState([]);
    //

    const [documentId, setDocumentId] = useState(null);

    console.log(user);
    const handleLogout = async() => {await logout();}

    //crear diagrama---------------------
    const handleSubmit = async (event) => {
        event.preventDefault();
        //const diagramaId = diagramas.diagramId //|| generateDiagramId();
        const diagramaId = generateDiagramId();
        await guardarDiagrama(diagramaId, nombre, codigo);
        navigate(`/diagram/${diagramaId}?nombre=${nombre}`)

    };


    const generateDiagramId = () => {
        return Date.now().toString(); // Genera un ID único utilizando la fecha y hora actual
    }; 
    
    /*const guardarDiagrama = async (diagramaId, nombre, codigo) => {
        try {
          const docRef = await addDoc(collection(db, 'diagramas'), {
            nombre: nombre,
            codigo: codigo,
            userId: user.uid, 
            createdAt: new Date(),
            diagramaId: diagramaId,
            nodeDataArray:  nodeDataArray || [],
            linkDataArray:  linkDataArray || [],
          });
          console.log('Diagrama creado con éxito, ID del documento:', docRef.id);
        } catch (error) {
          console.error('Error al crear el diagrama:', error);
        }
      };*/

    /*const guardarDiagrama = async (diagramaId, nombre, codigo) => {
        // Construye el objeto modelData
        const modelData = {
            "class": "_GraphLinksModel",
            "nodeDataArray": nodeDataArray, // Usa el estado actual de nodeDataArray
            "linkDataArray": linkDataArray // Usa el estado actual de linkDataArray
        };
    
        try {
            const docRef = await addDoc(collection(db, 'diagramas'), {
                diagramaId: diagramaId,
                nombre: nombre,
                codigo: codigo,
                userId: user.uid,
                modelData: JSON.stringify(modelData), // Guarda el modelo como una cadena JSON
                createdAt: new Date()
            });
            console.log('Diagrama creado con éxito, ID del documento:', docRef.id);
            //quiero imprimir todos los daros que se crean

           
        } catch (error) {
            console.error('Error al crear el diagrama:', error);
        }
    };*/

    const guardarDiagrama = async (diagramaId, nombre, codigo) => {
        // Construye el objeto modelData
        const modelData = {
            "class": "_GraphLinksModel",
            "nodeDataArray": nodeDataArray, // Usa el estado actual de nodeDataArray
            "linkDataArray": linkDataArray // Usa el estado actual de linkDataArray
        };
        try {
            const docRef = await addDoc(collection(db, 'diagramas'), {
                diagramaId: diagramaId,
                nombre: nombre,
                codigo: codigo,
                userId: user.uid,
                modelData: JSON.stringify(modelData), // Guarda el modelo como una cadena JSON
                createdAt: new Date()
            });

            // Guarda el ID del documento en el estado
           setDocumentId(docRef.id);
            console.log('Diagrama creado con éxito, ID del documento:', docRef.id);
         
        } catch (error) {
          console.error('Error al crear el diagrama:', error);
        }
      };
    
    
      

    const handleAccesoDiagramaCredenciales = async (event) => {
        event.preventDefault();
        try {
            const querySnapshot = await getDocs(collection(db, 'diagramas'));
            const diagrama = querySnapshot.docs.find(doc => doc.data().nombre === nombreAcceso && doc.data().codigo === codigoAcceso);
            if (diagrama) {
                navigate(`/diagram/${diagrama.data().diagramaId}?nombre=${diagrama.data().nombre}`);
            } else {
                console.error('No se encontró el diagrama con ese nombre y código.');
            }
        } catch (error) {
            console.error('Error al acceder al diagrama:', error);
        }
    };

    const handleAccesoDiagramaId = async (event) => {
        event.preventDefault();
        try {
            const querySnapshot = await getDocs(collection(db, 'diagramas'));
            const diagrama = querySnapshot.docs.find(doc => doc.data().diagramaId === idAcceso);
            if (diagrama) {
                navigate(`/diagram/${diagrama.data().diagramaId}?nombre=${diagrama.data().nombre}`);
            } else {
                console.error('No se encontró el diagrama con ese id');
            }
        } catch (error) {
            console.error('Error al acceder al diagrama:', error);
        }
    };

    //form acceder por credenciales o id
    const handleCredencialesClick = () => {
        setActiveForm('credenciales');
    };
    
    const handleIdClick = () => {
        setActiveForm('id');
    };

    // Función para obtener los diagramas del usuario
    const obtenerDiagramasUsuario = async () => {
        try {
            if (loading) return; 
            console.log('este es el usuarioID:',user.uid); // Imprime el uid del usuario en la consola
            const q = query(collection(db, 'diagramas'), where('userId', '==', user.uid));
            const querySnapshot = await getDocs(q);
            setDiagramas(querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
        } catch (error) {
            console.error("Error obteniendo los diagramas del usuario: ", error);
        }
    };

    
    const handleDiagramaClick = (diagramaId) => {
        navigate(`/diagram/${diagramaId}`);
    };

    const eliminarDiagrama = (diagramaId) => {
        setDiagramas(diagramas.filter(diagrama => diagrama.id !== diagramaId));
    };

    const handleUpdated = () => {
        setLastUpdated(Date.now());
    };

    useEffect(() => {
        obtenerDiagramasUsuario();
    }, [user, loading, lastUpdated]);
    
    return  (
    <div className='pagina_home'>
        {/* Navbar */}
        <nav className="navbar_container">
                <div className="texto_blanco">
                <span>Hola! {user.displayName || user.email}</span>
                </div>
                <div className="boton_logout"> 
                <Button  onClick={handleLogout}>Logout</Button>
                </div>
        </nav>

        <div className="sidebar_home">
            <form onSubmit={handleSubmit}><br/>
            <label htmlFor="nombre"><strong>CREAR UN DIAGRAMA:</strong></label> <br />
                <label htmlFor="nombre">Nombre:</label>
                <input type="text" id="nombre" name="nombre" value={nombre} onChange={(e) => setNombre(e.target.value)} required/> <br />
                <label htmlFor="codigo">Código:</label>
                <input type="text" id="codigo" name="codigo" value={codigo} onChange={(e) => setCodigo(e.target.value)} required/> <br /> <br />
                <Button type="submit">Crear </Button>
            </form><br/><br/>

            <hr /> <br/>

            <label htmlFor="nombreAcceso"><strong>ACCEDER A UN DIAGRAMA:</strong></label> <br />
            <button onClick={handleCredencialesClick}>Credenciales</button>/
            <button onClick={handleIdClick}>Id</button>
                {activeForm === 'credenciales' && (
                    <form onSubmit={handleAccesoDiagramaCredenciales }>
                        <label htmlFor="nombreAcceso">Nombre del Diagrama:</label>
                        <input type="text" id="nombreAcceso" name="nombreAcceso" value={nombreAcceso} onChange={(e) => setNombreAcceso(e.target.value)} required/> <br />
                        <label htmlFor="codigoAcceso">Código del Diagrama:</label>
                        <input type="text" id="codigoAcceso" name="codigoAcceso" value={codigoAcceso} onChange={(e) => setCodigoAcceso(e.target.value)} required/> <br /> <br />
                        <Button type="submit">Acceder</Button>
                    </form>  
                )}  
                
                {activeForm === 'id' && (
                <form onSubmit={handleAccesoDiagramaId }>
                    <label htmlFor="idAcceso">ID del Diagrama:</label>
                    <input type="text" id="idAcceso" name="idAcceso" value={idAcceso} onChange={(e) => setIdAcceso(e.target.value)} required/> <br /><br />
                    <Button type="submit">Acceder.</Button>
                </form> 
                )}
        </div>

        <div className="main-content">
            <div>
                <h1 className="title"> <strong>Mis Diagramas:</strong> </h1>
                <div style={{ display: 'flex', flexDirection: 'row', flexWrap: 'wrap' }}>
                    {diagramas.map(diagrama => (
                        <div className="diagrama-container"  key={diagrama.id}>
                            <DiagramaCard diagrama={diagrama} onDelete={eliminarDiagrama} handleUpdated={handleUpdated} />
                        </div >
                    ))}              
                </div>
            </div>

            <table>
                <tbody>
                    {diagramas.map(diagrama => (
                        <tr key={diagrama.id} onClick={() => handleDiagramaClick(diagrama.id)}>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>

    </div>
    )
} 

import { createContext, useContext, useEffect, useState } from "react";
import { auth } from "../firebase.jsx";
import { createUserWithEmailAndPassword,
         signInWithEmailAndPassword,
         onAuthStateChanged,
         signOut,
         GoogleAuthProvider,
         signInWithPopup,
} from "firebase/auth";


export const authContext = createContext();

export  const useAuth = () => {
    const context = useContext(authContext);
    if (!context){
        throw new Error("useAuth debe ser usado dentro de un AuthProvider");
    }
    return context;
}

export function AuthProvider ({ children }){
    const [user,setUser] = useState(null);
    const [loading, setLoading] = useState(true);

    const singUp = async (email, password) => {
        try {
            await createUserWithEmailAndPassword(auth, email, password);
        } catch (error) {
             if (error.code === 'auth/email-already-in-use') {
                 throw new Error('El correo electrónico ya está en uso');
            } else {
                console.error("Error al registrar usuario:", error.message);
                throw error;
            }
        }
    };

    const login = async (email, password) => {
        try {
            await signInWithEmailAndPassword(auth, email, password);
        } catch (error) {
            console.error("Error al iniciar sesión:", error.message);
            throw error;
        }
    };      

    const loginWithGoogle = async () => {
        const googleProvider = new GoogleAuthProvider();
        return signInWithPopup(auth, googleProvider);
    }; 

    const logout = () => signOut(auth);

    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
            console.log(currentUser);
            setUser(currentUser);  //setUser({currentUser});
            setLoading(false);
        });
        return () =>  unsubscribe();
    }, []);

    return (
    <authContext.Provider value={{ singUp, login, user, logout, loading, loginWithGoogle }}>
        {children} 
    </authContext.Provider>
    );
}

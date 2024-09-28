import React, { useState } from 'react';
import { db } from '../firebase.jsx';
import { getAuth } from "firebase/auth";
import { collection, addDoc, } from 'firebase/firestore';

export function Invitacion() {
  const auth = getAuth();
  const usuario = auth.currentUser ? auth.currentUser.email : null;

  // Estados para el modal y los datos del formulario
  const [isInviteModalOpen, setInviteModalOpen] = useState(false);
  const [emailData, setEmailData] = useState({
    destino: '',
    origen: 'Invitacion de:' + (usuario ||'Usuario Anónimo'), 
    texto: '',
  });

   // Manejador para actualizar los datos del formulario
   const handleInputChange = (e) => {
    const { name, value } = e.target;
    setEmailData(prevData => ({ ...prevData, [name]: value }));
  };

    const handleSendEmail = async () => {
        try {
          const mailCollectionRef = collection(db, 'mail');
          const docRef = await addDoc(mailCollectionRef, {
            to: emailData.destino,
            message: {
              subject: emailData.origen,
              html: emailData.texto,
            },
          });
          console.log('Correo enviado con ID: ', docRef.id);
          setInviteModalOpen(false); 
        } catch (error) {
          console.error("Error al enviar el correo:", error);
        }
      };

    return {
        isInviteModalOpen, 
        setInviteModalOpen,
        emailData, 
        setEmailData,
        handleInputChange,
        handleSendEmail,
    };

}    
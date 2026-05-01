import { 
  db, 
  handleFirestoreError, 
  OperationType 
} from './firebase';
import { 
  collection, 
  addDoc, 
  setDoc, 
  doc, 
  getDoc, 
  getDocs, 
  query, 
  where, 
  serverTimestamp, 
  updateDoc,
  deleteDoc,
  collectionGroup
} from 'firebase/firestore';

export interface Invitation {
  id?: string;
  email: string;
  itemId: string;
  itemType: 'note' | 'chat';
  ownerId: string;
  role: 'viewer' | 'editor';
  status: 'pending' | 'accepted' | 'declined';
  createdAt: any;
}

export const sendInvitation = async (
  currentUser: { uid: string, email: string | null },
  email: string,
  itemId: string,
  itemType: 'note' | 'chat',
  role: 'viewer' | 'editor' = 'viewer'
) => {
  const invitationsRef = collection(db, 'invitations');
  try {
    await addDoc(invitationsRef, {
      email,
      itemId,
      itemType,
      ownerId: currentUser.uid,
      role,
      status: 'pending',
      createdAt: serverTimestamp()
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, 'invitations');
  }
};

export const acceptInvitation = async (invitationId: string, currentUser: { uid: string, email: string | null }) => {
  const invitationRef = doc(db, 'invitations', invitationId);
  const path = `invitations/${invitationId}`;
  
  try {
    const invDoc = await getDoc(invitationRef);
    if (!invDoc.exists()) throw new Error('Invitation not found');
    const data = invDoc.data() as Invitation;
    
    // Add to members subcollection of the item
    // Note: We need items to have a record of who is a member
    const memberRef = doc(db, 'users', data.ownerId, data.itemType === 'note' ? 'notes' : 'chats', data.itemId, 'members', currentUser.uid);
    await setDoc(memberRef, {
      userId: currentUser.uid,
      email: currentUser.email,
      role: data.role,
      addedAt: serverTimestamp()
    });

    // Add to user's access index for easy listing
    const accessRef = doc(db, 'users', currentUser.uid, 'access', data.itemId);
    await setDoc(accessRef, {
      ownerId: data.ownerId,
      itemId: data.itemId,
      itemType: data.itemType,
      role: data.role,
      addedAt: serverTimestamp()
    });
    
    // Update invitation status
    await updateDoc(invitationRef, {
      status: 'accepted'
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
};

export const declineInvitation = async (invitationId: string) => {
  const invitationRef = doc(db, 'invitations', invitationId);
  const path = `invitations/${invitationId}`;
  try {
    await updateDoc(invitationRef, {
      status: 'declined'
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
};

export const getMembers = async (ownerId: string, itemType: 'notes' | 'chats', itemId: string) => {
  const membersRef = collection(db, 'users', ownerId, itemType, itemId, 'members');
  const path = `users/${ownerId}/${itemType}/${itemId}/members`;
  
  try {
    const snapshot = await getDocs(membersRef);
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, path);
    return [];
  }
};

export const removeMember = async (ownerId: string, itemType: 'notes' | 'chats', itemId: string, userId: string) => {
  const memberRef = doc(db, 'users', ownerId, itemType, itemId, 'members', userId);
  const accessRef = doc(db, 'users', userId, 'access', itemId);
  const path = `users/${ownerId}/${itemType}/${itemId}/members/${userId}`;
  
  try {
    await deleteDoc(memberRef);
    await deleteDoc(accessRef);
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
};

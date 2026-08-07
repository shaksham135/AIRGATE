import React, { useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import axios from 'axios';
import API_CONFIG from '../config/api';
import AIRGATELoader from './AIRGATELoader';

export default function QuestionRedirector({ type }) {
  const { id } = useParams();
  const navigate = useNavigate();

  useEffect(() => {
    if (!id) {
      navigate(type === 'practice' ? '/practice' : '/gate/cse', { replace: true });
      return;
    }

    let isMounted = true;
    axios.get(`${API_CONFIG.BASE_URL}/api/questions/${id}/redirect-url`)
      .then(res => {
        if (!isMounted) return;
        if (res.data && res.data.redirectUrl) {
          navigate(res.data.redirectUrl, { replace: true });
        } else {
          navigate(type === 'practice' ? '/practice' : '/gate/cse', { replace: true });
        }
      })
      .catch(() => {
        if (!isMounted) return;
        navigate('/explore', { replace: true });
      });

    return () => { isMounted = false; };
  }, [id, type, navigate]);

  return <AIRGATELoader fullPage message="Redirecting to SEO-friendly question page..." />;
}

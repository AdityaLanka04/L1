export const askTutor = async (userId, question) => {
  const formData = new FormData();
  formData.append("user_id", userId);
  formData.append("question", question);

  const response = await fetch("${API_URL}/ask/", {
    method: "POST",
    body: formData,
  });

  const data = await response.json();
  return data.answer;
};

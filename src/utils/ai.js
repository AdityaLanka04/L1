const API_BASE = "http://localhost:8000";

export const storeActivity = async (userId, activityData) => {
  const response = await fetch(`${API_BASE}/store_activity`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      user_id: userId,
      activity_data: activityData
    })
  });
  return await response.json();
};

export const askTutor = async (userId, question) => {
  const formData = new FormData();
  formData.append("user_id", userId);
  formData.append("question", question);

  const response = await fetch("http://localhost:8000/ask/", {
    method: "POST",
    body: formData
  });

  const data = await response.json();
  return data.answer;
};

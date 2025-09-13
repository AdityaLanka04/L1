const convertToCSV = (data) => {
  const headers = ["Title", "Review", "Rating", "Date"];
  const rows = data.map(row =>
    [row.title, row.review, row.rating, row.date].join(",")
  );
  return [headers.join(","), ...rows].join("\n");
};

export const uploadQuizData = async (userId, quizData) => {
  const csv = convertToCSV(quizData);
  const blob = new Blob([csv], { type: "text/csv" });
  const file = new File([blob], "quiz_data.csv");

  const formData = new FormData();
  formData.append("file", file);
  formData.append("user_id", userId);

  const response = await fetch("http://localhost:8000/upload_csv/", {
    method: "POST",
    body: formData,
  });

  return await response.json();
};

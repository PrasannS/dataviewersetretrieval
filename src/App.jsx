import React, { useState, useMemo } from 'react';
import { ChevronDown, ChevronRight, Save, FolderOpen, Tag, MessageSquare, ArrowLeft } from 'lucide-react';

const App = () => {
  const [files, setFiles] = useState([]);
  const [directoryHandle, setDirectoryHandle] = useState(null);
  const [selectedSet, setSelectedSet] = useState(null);
  const [selectedMethod, setSelectedMethod] = useState(null);
  const [currentRowIndex, setCurrentRowIndex] = useState(0);
  const [tagFilters, setTagFilters] = useState({});

  // --- File Loading Logic ---
  const loadDirectory = async () => {
    try {
      const handle = await window.showDirectoryPicker();
      setDirectoryHandle(handle);
      const fileList = [];
      
      for await (const entry of handle.values()) {
        if (entry.kind === 'file' && entry.name.endsWith('_preds2.jsonl')) {
          const file = await entry.getFile();
          const text = await file.text();
          const data = text.split('\n').filter(l => l.trim()).map(JSON.parse);
          
          const parts = entry.name.replace('_preds2.jsonl', '').split('_');
          const setname = parts[0];
          const method = parts.slice(1).join('_');
          const existingTags = Object.keys(data[0] || {}).filter(k => k.startsWith('tag_'));

          fileList.push({ name: entry.name, handle: entry, data, setname, method, tags: existingTags });
        }
      }
      setFiles(fileList);
    } catch (err) {
      console.error("Directory access denied", err);
    }
  };

  const saveFile = async (fileObj) => {
    try {
      const writable = await fileObj.handle.createWritable();
      const content = fileObj.data.map(row => JSON.stringify(row)).join('\n');
      await writable.write(content);
      await writable.close();
      alert(`Changes successfully saved to ${fileObj.name}`);
    } catch (err) {
      alert("Error saving: Ensure you have granted write permissions in your browser.");
    }
  };

  const calculateRecall = (data, filters) => {
    const filteredRows = data.filter(row => 
      Object.entries(filters).every(([tag, active]) => !active || row[tag] === true)
    );
    if (filteredRows.length === 0) return 0;
    const totalRecall = filteredRows.reduce((acc, row) => {
      const golds = row.golds || [];
      const preds = new Set(row.preds || []);
      const matches = golds.filter(g => preds.has(g)).length;
      return acc + (matches / Math.min(100, golds.length || 1));
    }, 0);
    return (totalRecall / filteredRows.length * 100).toFixed(2);
  };

  const currentFile = files.find(f => f.setname === selectedSet && f.method === selectedMethod);
  const methodsForSet = useMemo(() => 
    [...new Set(files.filter(f => f.setname === selectedSet).map(f => f.method))],
    [files, selectedSet]
  );

  // --- Row Logic for Counts ---
  const currentRow = currentFile?.data[currentRowIndex];
  const truePositives = useMemo(() => 
    currentRow ? currentRow.preds.filter(p => currentRow.golds.includes(p)) : [], 
    [currentRow]);
  const falseNegatives = useMemo(() => 
    currentRow ? currentRow.golds.filter(g => !currentRow.preds.includes(g)) : [], 
    [currentRow]);
  const falsePositives = useMemo(() => 
    currentRow ? currentRow.preds.filter(p => !currentRow.golds.includes(p)) : [], 
    [currentRow]);

  const RowCard = ({ title, content, type }) => {
    const [isExpanded, setIsExpanded] = useState(false);
    const bgColor = type === 'tp' ? 'bg-green-100 border-green-500 text-green-900' : 
                    type === 'fn' ? 'bg-orange-50 border-orange-400 text-orange-900' : 
                    'bg-red-50 border-red-400 text-red-900';

    return (
      <div className={`mb-3 p-3 border-l-4 rounded shadow-sm ${bgColor} overflow-hidden transition-all w-full`}>
        <div className="flex justify-between items-start cursor-pointer gap-2" onClick={() => setIsExpanded(!isExpanded)}>
          <div className="flex-1 min-w-0">
            <span className="text-[10px] font-black uppercase opacity-50 block mb-1">{title}</span>
            <p className={`text-sm break-words ${isExpanded ? "whitespace-pre-wrap" : "line-clamp-1"}`}>
              {content}
            </p>
          </div>
          <div className="flex-shrink-0 pt-1">
            {isExpanded ? <ChevronDown size={14}/> : <ChevronRight size={14}/>}
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-slate-50 p-4 md:p-8 font-sans text-slate-900">
      <header className="mb-8 flex justify-between items-center bg-white p-4 rounded-2xl shadow-sm border border-slate-200">
        <h1 className="text-2xl font-black tracking-tight">Data<span className="text-blue-600">Viz</span></h1>
        {!directoryHandle ? (
          <button onClick={loadDirectory} className="flex items-center gap-2 bg-blue-600 text-white px-5 py-2.5 rounded-full font-bold hover:bg-blue-700 shadow-lg transition cursor-pointer">
            <FolderOpen size={18}/> Open JSONL Folder
          </button>
        ) : (
          <button onClick={() => saveFile(currentFile)} disabled={!currentFile} className="flex items-center gap-2 bg-green-600 text-white px-5 py-2.5 rounded-full font-bold hover:bg-green-700 disabled:opacity-30 transition cursor-pointer">
            <Save size={18}/> Save Changes
          </button>
        )}
      </header>

      {!selectedSet ? (
        /* DASHBOARD VIEW */
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[...new Set(files.map(f => f.setname))].map(set => (
            <div key={set} className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
              <h2 className="text-xl font-bold mb-4">{set}</h2>
              {files.filter(f => f.setname === set).map(f => (
                <div key={f.method} className="flex justify-between items-center mb-2 p-2 hover:bg-slate-50 rounded border border-transparent hover:border-slate-100">
                  <span className="text-sm font-medium">{f.method}</span>
                  <div className="flex items-center gap-4">
                    <span className="text-xs font-mono font-bold text-blue-600">Avg Recall: {calculateRecall(f.data, tagFilters)}%</span>
                    <button onClick={() => {setSelectedSet(set); setSelectedMethod(f.method)}} className="text-xs bg-slate-900 text-white px-3 py-1.5 rounded-md hover:bg-slate-700 cursor-pointer">View</button>
                  </div>
                </div>
              ))}
              <div className="mt-4 pt-4 border-t border-slate-100 flex flex-wrap gap-2">
                <span className="w-full text-[10px] font-bold text-slate-400 uppercase">Filter by Tags:</span>
                {files.find(f => f.setname === set)?.tags.map(tag => (
                  <label key={tag} className="flex items-center gap-1.5 text-xs bg-slate-100 px-2.5 py-1.5 rounded-lg cursor-pointer hover:bg-slate-200 transition">
                    <input type="checkbox" className="rounded" onChange={(e) => setTagFilters({...tagFilters, [tag]: e.target.checked})} /> {tag.replace('tag_', '')}
                  </label>
                ))}
              </div>
            </div>
          ))}
        </div>
      ) : (
        /* INDIVIDUAL DATA VIEW */
        <div className="max-w-6xl mx-auto">
          <button onClick={() => {setSelectedSet(null); setCurrentRowIndex(0)}} className="mb-6 text-blue-600 font-bold flex items-center gap-2 hover:underline cursor-pointer"> 
            <ArrowLeft size={16}/> Back to Dashboard
          </button>
          
          <div className="bg-white p-6 rounded-2xl shadow-xl border border-slate-200">
            {/* Nav & Method Selector */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4 pb-6 border-b border-slate-100">
              <div className="w-full md:w-auto">
                <h2 className="text-2xl font-black mb-1">{selectedSet}</h2>
                <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-slate-400 uppercase">Method:</span>
                    <select 
                      value={selectedMethod} 
                      onChange={(e) => setSelectedMethod(e.target.value)}
                      className="bg-slate-50 border border-slate-200 text-sm rounded-lg px-2 py-1 outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer"
                    >
                      {methodsForSet.map(m => <option key={m} value={m}>{m}</option>)}
                    </select>
                </div>
              </div>
              <div className="flex items-center gap-3 w-full md:w-auto justify-between md:justify-end">
                <button onClick={() => setCurrentRowIndex(Math.max(0, currentRowIndex - 1))} className="px-4 py-2 bg-slate-100 rounded-lg hover:bg-slate-200 font-bold transition cursor-pointer">Prev</button>
                <div className="text-center px-4">
                    <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Entry</div>
                    <span className="font-mono font-bold text-lg">{currentRowIndex + 1} / {currentFile.data.length}</span>
                </div>
                <button onClick={() => setCurrentRowIndex(Math.min(currentFile.data.length - 1, currentRowIndex + 1))} className="px-4 py-2 bg-slate-100 rounded-lg hover:bg-slate-200 font-bold transition cursor-pointer">Next</button>
              </div>
            </div>

            {/* EDITING SECTION (TOP) */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8 bg-slate-50 p-6 rounded-xl border border-slate-100">
              <div>
                <h3 className="text-xs font-black uppercase text-slate-500 mb-2 flex items-center gap-2">
                    <MessageSquare size={14}/> Row Notes
                </h3>
                <textarea 
                  className="w-full h-24 p-3 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 text-sm bg-white"
                  value={currentRow.notes || ""}
                  onChange={(e) => {
                    const newData = [...currentFile.data];
                    newData[currentRowIndex].notes = e.target.value;
                    setFiles([...files]);
                  }}
                  placeholder="Annotate this row..."
                />
              </div>
              <div>
                <h3 className="text-xs font-black uppercase text-slate-500 mb-2 flex items-center justify-between">
                    <span className="flex items-center gap-2"><Tag size={14}/> Row Tags</span>
                    <button onClick={() => {
                      const tagName = prompt("Enter tag name (e.g., 'CheckLater'):");
                      if (tagName) {
                        currentFile.tags.push(`tag_${tagName}`);
                        currentFile.data.forEach(row => row[`tag_${tagName}`] = row[`tag_${tagName}`] ?? false);
                        setFiles([...files]);
                      }
                    }} className="text-blue-600 hover:text-blue-800 text-[10px] font-black border border-blue-200 px-2 py-0.5 rounded cursor-pointer uppercase tracking-tight">+ Define New</button>
                </h3>
                <div className="flex flex-wrap gap-2">
                  {currentFile.tags.map(tag => (
                    <button 
                      key={tag}
                      onClick={() => {
                        currentRow[tag] = !currentRow[tag];
                        setFiles([...files]);
                      }}
                      className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition cursor-pointer ${currentRow[tag] ? 'bg-blue-600 text-white border-blue-600 shadow-md' : 'bg-white text-slate-500 border-slate-200 hover:border-slate-300'}`}
                    >
                      {tag.replace('tag_', '')}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* MAIN CONTENT */}
            <div className="space-y-8">
              <section className="bg-slate-900 text-white p-6 rounded-xl shadow-inner">
                <h3 className="text-[10px] font-black uppercase text-slate-500 mb-2 tracking-widest">Question</h3>
                <p className="text-lg font-medium leading-relaxed">{currentRow.question}</p>
              </section>

              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Column: TP */}
                <div className="min-w-0">
                  <h3 className="text-xs font-black mb-4 text-green-600 border-b border-green-100 pb-2 flex justify-between">
                    <span>TRUE POSITIVES</span>
                    <span className="bg-green-100 px-2 rounded-full">({truePositives.length})</span>
                  </h3>
                  {truePositives.map((item, i) => (
                    <RowCard key={i} title="Match" content={item} type="tp" />
                  ))}
                </div>

                {/* Column: FN */}
                <div className="min-w-0">
                  <h3 className="text-xs font-black mb-4 text-orange-600 border-b border-orange-100 pb-2 flex justify-between">
                    <span>FALSE NEGATIVES</span>
                    <span className="bg-orange-100 px-2 rounded-full">({falseNegatives.length})</span>
                  </h3>
                  {falseNegatives.map((item, i) => (
                    <RowCard key={i} title="Gold Missing in Preds" content={item} type="fn" />
                  ))}
                </div>

                {/* Column: FP */}
                <div className="min-w-0">
                  <h3 className="text-xs font-black mb-4 text-red-600 border-b border-red-100 pb-2 flex justify-between">
                    <span>FALSE POSITIVES</span>
                    <span className="bg-red-100 px-2 rounded-full">({falsePositives.length})</span>
                  </h3>
                  {falsePositives.map((item, i) => (
                    <RowCard key={i} title="Pred Not in Golds" content={item} type="fp" />
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default App;
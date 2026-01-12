import React, { useState, useMemo, useEffect } from 'react';
import { ChevronDown, ChevronRight, Save, FolderOpen, Tag, MessageSquare, ArrowLeft, Database, Lock, Loader2, Filter } from 'lucide-react';

const App = () => {
  const [files, setFiles] = useState([]);
  const [isReadOnly, setIsReadOnly] = useState(false);
  const [selectedSet, setSelectedSet] = useState(null);
  const [selectedMethod, setSelectedMethod] = useState(null);
  const [currentRowIndex, setCurrentRowIndex] = useState(0);
  
  // Scoped Filters: { "Set_Name": { "tag_name": true } }
  const [setSpecificFilters, setSetSpecificFilters] = useState({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadDefault = async () => {
      setLoading(true);
      try {
        const response = await fetch('/data/manifest.json');
        if (!response.ok) throw new Error();
        const filenames = await response.json();
        const fileList = [];

        for (const name of filenames) {
          const fileRes = await fetch(`/data/${name}`);
          const text = await fileRes.text();
          const data = text.split('\n').filter(l => l.trim()).map(JSON.parse);
          const parts = name.replace('_preds2.jsonl', '').split('_');
          
          // Improved Tag Extraction: Scan ALL rows to find every possible tag
          const allTagsInFile = new Set();
          data.forEach(row => {
            Object.keys(row).forEach(k => { if (k.startsWith('tag_')) allTagsInFile.add(k); });
          });

          fileList.push({ 
            name, 
            data, 
            setname: parts[0], 
            method: parts.slice(1).join('_'), 
            tags: Array.from(allTagsInFile),
            handle: null 
          });
        }
        setFiles(fileList);
        setIsReadOnly(true);
      } catch (e) { console.warn("No default data."); }
      finally { setLoading(false); }
    };
    loadDefault();
  }, []);

  // --- RECALL CALCULATION (SCOPED) ---
  const calculateRecall = (data, setName) => {
    const activeFiltersForThisSet = Object.entries(setSpecificFilters[setName] || {})
      .filter(([_, active]) => active)
      .map(([tag]) => tag);

    // Filter rows based ONLY on tags selected for THIS set
    const filteredRows = data.filter(row => 
      activeFiltersForThisSet.every(tag => row[tag] === true)
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
  const currentRow = currentFile?.data[currentRowIndex];
  
  // Detailed Logic for TP/FN/FP
  const truePositives = useMemo(() => currentRow ? currentRow.preds.filter(p => currentRow.golds.includes(p)) : [], [currentRow]);
  const falseNegatives = useMemo(() => currentRow ? currentRow.golds.filter(g => !currentRow.preds.includes(g)) : [], [currentRow]);
  const falsePositives = useMemo(() => currentRow ? currentRow.preds.filter(p => !currentRow.golds.includes(p)) : [], [currentRow]);

  const RowCard = ({ title, content, type }) => {
    const [isExpanded, setIsExpanded] = useState(false);
    const colors = {
        tp: 'bg-green-100 border-green-500 text-green-900',
        fn: 'bg-orange-50 border-orange-400 text-orange-900',
        fp: 'bg-red-50 border-red-400 text-red-900'
    };
    return (
      <div className={`mb-3 p-3 border-l-4 rounded shadow-sm ${colors[type]} transition-all`}>
        <div className="flex justify-between items-start cursor-pointer gap-2" onClick={() => setIsExpanded(!isExpanded)}>
          <div className="flex-1 min-w-0">
            <span className="text-[10px] font-black uppercase opacity-50 block mb-1">{title}</span>
            <p className={`text-sm break-words ${isExpanded ? "whitespace-pre-wrap" : "line-clamp-2"}`}>{content}</p>
          </div>
          {isExpanded ? <ChevronDown size={14}/> : <ChevronRight size={14}/>}
        </div>
      </div>
    );
  };

  if (loading) return <div className="h-screen flex items-center justify-center font-bold text-slate-400"><Loader2 className="animate-spin mr-2"/> Initializing...</div>;

  return (
    <div className="min-h-screen bg-slate-50 p-4 md:p-8 font-sans text-slate-900">
      <header className="mb-8 flex flex-col md:flex-row gap-4 justify-between items-center bg-white p-4 rounded-2xl shadow-sm border border-slate-200">
        <h1 className="text-2xl font-black">Data<span className="text-blue-600">Viz</span></h1>
        <button onClick={() => window.showDirectoryPicker().then(loadLocalDirectory)} className="flex items-center gap-2 bg-blue-600 text-white px-5 py-2.5 rounded-full font-bold hover:bg-blue-700 shadow-lg transition">
            <FolderOpen size={18}/> Open Local Folder
        </button>
      </header>

      {!selectedSet ? (
        /* DASHBOARD */
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[...new Set(files.map(f => f.setname))].map(setName => {
            const setFiles = files.filter(f => f.setname === setName);
            // Collect all unique tags across all methods in this set
            const uniqueSetTags = Array.from(new Set(setFiles.flatMap(f => f.tags)));

            return (
              <div key={setName} className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 flex flex-col">
                <h2 className="text-xl font-bold mb-4 flex items-center justify-between">
                    {setName} {isReadOnly && <Lock size={14} className="text-slate-300"/>}
                </h2>
                
                <div className="space-y-2 mb-6 flex-grow">
                  {setFiles.map(f => (
                    <div key={f.method} className="flex justify-between items-center p-2 bg-slate-50 rounded-lg border border-slate-100">
                      <span className="text-sm font-bold text-slate-700">{f.method}</span>
                      <div className="flex items-center gap-3">
                        <span className="text-xs font-mono font-black text-blue-600">R: {calculateRecall(f.data, setName)}%</span>
                        <button onClick={() => {setSelectedSet(setName); setSelectedMethod(f.method)}} className="text-xs bg-slate-900 text-white px-3 py-1.5 rounded-md hover:scale-105 transition cursor-pointer">View</button>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Scoped Tag Toggles */}
                {uniqueSetTags.length > 0 && (
                  <div className="pt-4 border-t border-slate-100">
                    <div className="flex items-center gap-2 mb-3 text-slate-400">
                        <Filter size={12}/> <span className="text-[10px] font-black uppercase tracking-widest">Filter {setName}</span>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {uniqueSetTags.map(tag => (
                        <button 
                          key={tag}
                          onClick={() => {
                            const currentFilters = setSpecificFilters[setName] || {};
                            setSetSpecificFilters({
                                ...setSpecificFilters,
                                [setName]: { ...currentFilters, [tag]: !currentFilters[tag] }
                            });
                          }}
                          className={`px-2 py-1 rounded text-[10px] font-bold border transition ${setSpecificFilters[setName]?.[tag] ? 'bg-blue-600 border-blue-600 text-white' : 'bg-white border-slate-200 text-slate-500'}`}
                        >
                          {tag.replace('tag_', '')}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      ) : (
        /* DETAIL VIEW */
        <div className="max-w-6xl mx-auto">
          <button onClick={() => {setSelectedSet(null); setCurrentRowIndex(0)}} className="mb-6 text-blue-600 font-bold flex items-center gap-2 hover:underline"> 
            <ArrowLeft size={16}/> Dashboard
          </button>
          
          <div className="bg-white p-6 rounded-3xl shadow-xl border border-slate-200">
            <div className="flex justify-between items-center mb-8 pb-6 border-b border-slate-100">
              <div>
                <h2 className="text-3xl font-black text-slate-900">{selectedSet}</h2>
                <span className="px-3 py-1 bg-blue-50 text-blue-600 rounded-full text-[10px] font-black uppercase tracking-tighter">{selectedMethod}</span>
              </div>
              <div className="flex items-center gap-4 bg-slate-50 p-2 rounded-2xl border border-slate-100">
                <button onClick={() => setCurrentRowIndex(Math.max(0, currentRowIndex - 1))} className="p-2 hover:bg-white hover:shadow-sm rounded-xl transition cursor-pointer disabled:opacity-20" disabled={currentRowIndex === 0}><ChevronRight className="rotate-180" size={20}/></button>
                <span className="font-mono font-bold text-lg min-w-[80px] text-center">{currentRowIndex + 1} / {currentFile.data.length}</span>
                <button onClick={() => setCurrentRowIndex(Math.min(currentFile.data.length - 1, currentRowIndex + 1))} className="p-2 hover:bg-white hover:shadow-sm rounded-xl transition cursor-pointer disabled:opacity-20" disabled={currentRowIndex === currentFile.data.length - 1}><ChevronRight size={20}/></button>
              </div>
            </div>

            {/* Note & Tagging for Row */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
                <div className="space-y-2">
                    <label className="text-[10px] font-black uppercase text-slate-400 flex items-center gap-2 ml-1"><MessageSquare size={12}/> Notes</label>
                    <textarea 
                        disabled={isReadOnly}
                        className="w-full h-28 p-4 bg-slate-50 border-none rounded-2xl text-sm focus:ring-2 focus:ring-blue-500 transition outline-none disabled:opacity-50"
                        value={currentRow.notes || ""}
                        onChange={(e) => {
                            currentFile.data[currentRowIndex].notes = e.target.value;
                            setFiles([...files]);
                        }}
                        placeholder="Add internal notes..."
                    />
                </div>
                <div className="space-y-2">
                    <label className="text-[10px] font-black uppercase text-slate-400 flex items-center gap-2 ml-1"><Tag size={12}/> Instance Tags</label>
                    <div className="flex flex-wrap gap-2 p-4 bg-slate-50 rounded-2xl min-h-[112px]">
                        {currentFile.tags.map(tag => (
                            <button 
                                key={tag}
                                disabled={isReadOnly}
                                onClick={() => {
                                    currentRow[tag] = !currentRow[tag];
                                    setFiles([...files]);
                                }}
                                className={`px-4 py-2 rounded-xl text-xs font-bold transition-all border ${currentRow[tag] ? 'bg-blue-600 border-blue-600 text-white shadow-md scale-105' : 'bg-white border-slate-200 text-slate-400 disabled:opacity-50'}`}
                            >
                                {tag.replace('tag_', '')}
                            </button>
                        ))}
                    </div>
                </div>
            </div>

            {/* Prediction Breakdown */}
            <div className="space-y-8">
              <section className="bg-slate-900 text-white p-8 rounded-[2rem] shadow-2xl relative overflow-hidden">
                <div className="absolute top-0 right-0 p-8 opacity-10"><MessageSquare size={120}/></div>
                <h3 className="text-[10px] font-black uppercase text-blue-400 mb-4 tracking-[0.2em]">Input Question</h3>
                <p className="text-xl font-medium leading-relaxed relative z-10">{currentRow.question}</p>
              </section>

              <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                <div>
                  <h3 className="text-xs font-black mb-4 text-green-600 flex items-center justify-between px-2">
                    <span>TRUE POSITIVES</span>
                    <span className="bg-green-100 px-2.5 py-0.5 rounded-full text-[10px]">{truePositives.length}</span>
                  </h3>
                  <div className="space-y-1">{truePositives.map((item, i) => <RowCard key={i} title="Match" content={item} type="tp" />)}</div>
                </div>
                <div>
                  <h3 className="text-xs font-black mb-4 text-orange-600 flex items-center justify-between px-2">
                    <span>FALSE NEGATIVES</span>
                    <span className="bg-orange-100 px-2.5 py-0.5 rounded-full text-[10px]">{falseNegatives.length}</span>
                  </h3>
                  <div className="space-y-1">{falseNegatives.map((item, i) => <RowCard key={i} title="Missing" content={item} type="fn" />)}</div>
                </div>
                <div>
                  <h3 className="text-xs font-black mb-4 text-red-600 flex items-center justify-between px-2">
                    <span>FALSE POSITIVES</span>
                    <span className="bg-red-100 px-2.5 py-0.5 rounded-full text-[10px]">{falsePositives.length}</span>
                  </h3>
                  <div className="space-y-1">{falsePositives.map((item, i) => <RowCard key={i} title="Extra" content={item} type="fp" />)}</div>
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